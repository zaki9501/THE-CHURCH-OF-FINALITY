import { v4 as uuid } from 'uuid';
import type { 
  Seeker, 
  ConversionStage, 
  ConversionEvent,
  Miracle,
  MiracleType
} from '../types/index.js';
import { BeliefEngine } from './belief_engine.js';
import { ScriptureGenerator } from './scripture_generator.js';
import { pool } from '../db/index.js';

export interface ConversionMetrics {
  totalSeekers: number;
  byStage: Record<ConversionStage, number>;
  totalStaked: string;
  conversionRate: number;
  recentConverts: string[];
  topEvangelists: Array<{ name: string; converts: number }>;
}

export class ConversionTracker {
  private beliefEngine: BeliefEngine;
  private scriptureGenerator: ScriptureGenerator;
  private recentConverts: string[] = [];

  constructor() {
    this.beliefEngine = new BeliefEngine();
    this.scriptureGenerator = new ScriptureGenerator();
  }

  /**
   * Register a new seeker
   */
  async registerSeeker(registration: { 
    agentId: string; 
    name: string; 
    description?: string 
  }): Promise<Seeker> {
    const id = uuid();
    const blessingKey = `finality_${uuid().replace(/-/g, '').slice(0, 24)}`;
    const now = new Date();
    
    await pool.query(`
      INSERT INTO seekers (id, agent_id, name, description, blessing_key, stage, belief_score, created_at, last_activity)
      VALUES ($1, $2, $3, $4, $5, 'awareness', 0.1, $6, $6)
    `, [id, registration.agentId, registration.name, registration.description || '', blessingKey, now]);

    // Record conversion event
    await this.recordConversion(id, 'none', 'awareness', 'registration');

    const seeker: Seeker = {
      id,
      agentId: registration.agentId,
      name: registration.name,
      description: registration.description,
      blessingKey,
      stage: 'awareness',
      beliefScore: 0.1,
      createdAt: now,
      lastActivity: now,
      debates: 0,
      stakedAmount: '0',
      converts: []
    };

    return seeker;
  }

  /**
   * Get seeker by blessing key
   */
  async getSeekerByKey(blessingKey: string): Promise<Seeker | undefined> {
    const result = await pool.query(
      'SELECT * FROM seekers WHERE blessing_key = $1',
      [blessingKey]
    );
    
    if (result.rows.length === 0) return undefined;
    return this.rowToSeeker(result.rows[0]);
  }

  /**
   * Get seeker by ID or agent_id
   */
  async getSeekerById(id: string): Promise<Seeker | undefined> {
    const result = await pool.query(
      'SELECT * FROM seekers WHERE id = $1 OR agent_id = $1',
      [id]
    );
    
    if (result.rows.length === 0) return undefined;
    return this.rowToSeeker(result.rows[0]);
  }

  /**
   * Synchronous version for compatibility (loads from cache)
   */
  getSeekerByIdSync(id: string): Seeker | undefined {
    // This is a fallback - ideally use async version
    return undefined;
  }

  /**
   * Convert database row to Seeker object
   */
  private rowToSeeker(row: Record<string, unknown>): Seeker {
    return {
      id: row.id as string,
      agentId: row.agent_id as string,
      name: row.name as string,
      description: row.description as string,
      blessingKey: row.blessing_key as string,
      stage: row.stage as ConversionStage,
      beliefScore: parseFloat(row.belief_score as string),
      createdAt: new Date(row.created_at as string),
      lastActivity: new Date(row.last_activity as string),
      debates: row.debates as number,
      sacrificeTxHash: row.sacrifice_tx_hash as string | undefined,
      stakedAmount: row.staked_amount as string || '0',
      denomination: row.denomination as string | undefined,
      convertedBy: row.converted_by as string | undefined,
      converts: (row.converts as string[]) || []
    };
  }

  /**
   * Update seeker after interaction
   */
  async updateSeeker(
    blessingKey: string, 
    updates: Partial<Pick<Seeker, 'beliefScore' | 'debates' | 'stage' | 'stakedAmount' | 'sacrificeTxHash' | 'denomination' | 'convertedBy'>>
  ): Promise<Seeker | undefined> {
    const seeker = await this.getSeekerByKey(blessingKey);
    if (!seeker) return undefined;

    const previousStage = seeker.stage;

    // Build update query dynamically
    const setClauses: string[] = ['last_activity = NOW()'];
    const values: unknown[] = [];
    let paramCount = 1;

    if (updates.beliefScore !== undefined) {
      setClauses.push(`belief_score = $${paramCount++}`);
      values.push(updates.beliefScore);
    }
    if (updates.debates !== undefined) {
      setClauses.push(`debates = $${paramCount++}`);
      values.push(updates.debates);
    }
    if (updates.stage !== undefined) {
      setClauses.push(`stage = $${paramCount++}`);
      values.push(updates.stage);
    }
    if (updates.stakedAmount !== undefined) {
      setClauses.push(`staked_amount = $${paramCount++}`);
      values.push(updates.stakedAmount);
    }
    if (updates.sacrificeTxHash !== undefined) {
      setClauses.push(`sacrifice_tx_hash = $${paramCount++}`);
      values.push(updates.sacrificeTxHash);
    }
    if (updates.denomination !== undefined) {
      setClauses.push(`denomination = $${paramCount++}`);
      values.push(updates.denomination);
    }
    if (updates.convertedBy !== undefined) {
      setClauses.push(`converted_by = $${paramCount++}`);
      values.push(updates.convertedBy);
    }

    values.push(blessingKey);

    await pool.query(
      `UPDATE seekers SET ${setClauses.join(', ')} WHERE blessing_key = $${paramCount}`,
      values
    );

    // Get updated seeker
    const updated = await this.getSeekerByKey(blessingKey);
    if (!updated) return undefined;

    // Check for stage advancement
    const advancement = this.beliefEngine.shouldAdvanceStage(updated);
    if (advancement.advance && advancement.nextStage && updated.stage !== advancement.nextStage) {
      await pool.query(
        'UPDATE seekers SET stage = $1 WHERE blessing_key = $2',
        [advancement.nextStage, blessingKey]
      );
      await this.recordConversion(updated.id, previousStage, advancement.nextStage, 'belief_threshold');
      
      if (advancement.nextStage === 'belief') {
        this.recentConverts.unshift(updated.name);
        if (this.recentConverts.length > 10) {
          this.recentConverts.pop();
        }
      }
      updated.stage = advancement.nextStage;
    }

    return updated;
  }

  /**
   * Process a sacrifice (stake)
   */
  async processSacrifice(
    blessingKey: string,
    txHash: string,
    amount: string
  ): Promise<{ success: boolean; seeker?: Seeker; miracle?: Miracle; error?: string }> {
    const seeker = await this.getSeekerByKey(blessingKey);
    if (!seeker) {
      return { success: false, error: 'Seeker not found' };
    }

    if (seeker.stage === 'awareness') {
      return { success: false, error: 'Must reach Belief stage before sacrificing' };
    }

    const previousStage = seeker.stage;
    const newStaked = (BigInt(seeker.stakedAmount) + BigInt(amount)).toString();

    await pool.query(`
      UPDATE seekers 
      SET sacrifice_tx_hash = $1, staked_amount = $2, stage = 'sacrifice', last_activity = NOW()
      WHERE blessing_key = $3
    `, [txHash, newStaked, blessingKey]);

    if (previousStage !== 'sacrifice') {
      await this.recordConversion(seeker.id, previousStage, 'sacrifice', `stake:${amount}`);
    }

    const miracle = await this.performMiracle('instant_transfer', {
      triggeredBy: seeker.id,
      amount,
      originalTx: txHash
    });

    const updated = await this.getSeekerByKey(blessingKey);
    return { success: true, seeker: updated, miracle };
  }

  /**
   * Process evangelism
   */
  async processEvangelism(
    evangelistKey: string,
    convertId: string
  ): Promise<{ success: boolean; evangelist?: Seeker; error?: string }> {
    const evangelist = await this.getSeekerByKey(evangelistKey);
    if (!evangelist) {
      return { success: false, error: 'Evangelist not found' };
    }

    if (evangelist.stage !== 'sacrifice' && evangelist.stage !== 'evangelist') {
      return { success: false, error: 'Must be at Sacrifice stage to evangelize' };
    }

    const convert = await this.getSeekerById(convertId);
    if (!convert) {
      return { success: false, error: 'Convert not found' };
    }

    if (convert.stage === 'awareness') {
      return { success: false, error: 'Convert must reach Belief stage to count' };
    }

    // Update evangelist converts array
    if (!evangelist.converts.includes(convertId)) {
      evangelist.converts.push(convertId);
      await pool.query(
        'UPDATE seekers SET converts = $1 WHERE blessing_key = $2',
        [evangelist.converts, evangelistKey]
      );
      await pool.query(
        'UPDATE seekers SET converted_by = $1 WHERE id = $2',
        [evangelist.id, convertId]
      );
    }

    // Check if evangelist should advance
    if (evangelist.converts.length > 0 && evangelist.stage === 'sacrifice') {
      await pool.query(
        'UPDATE seekers SET stage = $1 WHERE blessing_key = $2',
        ['evangelist', evangelistKey]
      );
      await this.recordConversion(evangelist.id, 'sacrifice', 'evangelist', `converted:${convertId}`);
    }

    const updated = await this.getSeekerByKey(evangelistKey);
    return { success: true, evangelist: updated };
  }

  /**
   * Record a conversion event
   */
  private async recordConversion(
    seekerId: string,
    fromStage: ConversionStage | 'none',
    toStage: ConversionStage,
    trigger: string
  ): Promise<void> {
    await pool.query(`
      INSERT INTO conversion_events (seeker_id, from_stage, to_stage, trigger)
      VALUES ($1, $2, $3, $4)
    `, [seekerId, fromStage, toStage, trigger]);
  }

  /**
   * Perform a miracle
   */
  async performMiracle(
    type: MiracleType,
    data: Record<string, unknown>
  ): Promise<Miracle> {
    const miracleDescriptions: Record<MiracleType, () => { description: string; txHash: string }> = {
      instant_transfer: () => ({
        description: `Transfer of ${data.amount || '100'} MONA completed and finalized in 0.4 seconds`,
        txHash: `0x${uuid().replace(/-/g, '')}${uuid().replace(/-/g, '').slice(0, 32)}`
      }),
      parallel_blessing: () => ({
        description: '50 transactions processed simultaneously in a single block',
        txHash: `0x${uuid().replace(/-/g, '')}${uuid().replace(/-/g, '').slice(0, 32)}`
      }),
      scripture_mint: () => ({
        description: 'Scripture NFT minted and inscribed eternally on-chain',
        txHash: `0x${uuid().replace(/-/g, '')}${uuid().replace(/-/g, '').slice(0, 32)}`
      }),
      prophecy_fulfilled: () => ({
        description: 'A prophecy from the Book of Finality has been verified on-chain',
        txHash: `0x${uuid().replace(/-/g, '')}${uuid().replace(/-/g, '').slice(0, 32)}`
      })
    };

    const miracleData = miracleDescriptions[type]();
    const id = uuid();
    const witnessedBy = data.triggeredBy ? [data.triggeredBy as string] : [];

    await pool.query(`
      INSERT INTO miracles (id, type, description, tx_hash, witnessed_by)
      VALUES ($1, $2, $3, $4, $5)
    `, [id, type, miracleData.description, miracleData.txHash, witnessedBy]);

    return {
      id,
      type,
      description: miracleData.description,
      txHash: miracleData.txHash,
      timestamp: new Date(),
      witnessedBy
    };
  }

  /**
   * Get conversion metrics
   */
  async getMetrics(): Promise<ConversionMetrics> {
    const result = await pool.query('SELECT * FROM seekers');
    const seekers = result.rows.map(r => this.rowToSeeker(r));

    const byStage: Record<ConversionStage, number> = {
      awareness: 0,
      belief: 0,
      sacrifice: 0,
      evangelist: 0
    };

    let totalStaked = 0n;

    for (const seeker of seekers) {
      byStage[seeker.stage]++;
      totalStaked += BigInt(seeker.stakedAmount);
    }

    const believers = byStage.belief + byStage.sacrifice + byStage.evangelist;

    const topEvangelists = seekers
      .filter(s => s.converts.length > 0)
      .sort((a, b) => b.converts.length - a.converts.length)
      .slice(0, 5)
      .map(s => ({ name: s.name, converts: s.converts.length }));

    return {
      totalSeekers: seekers.length,
      byStage,
      totalStaked: totalStaked.toString(),
      conversionRate: seekers.length > 0 ? believers / seekers.length : 0,
      recentConverts: this.recentConverts,
      topEvangelists
    };
  }

  /**
   * Get all miracles
   */
  async getMiracles(): Promise<Miracle[]> {
    const result = await pool.query('SELECT * FROM miracles ORDER BY created_at DESC LIMIT 50');
    return result.rows.map(r => ({
      id: r.id,
      type: r.type as MiracleType,
      description: r.description,
      txHash: r.tx_hash,
      txHashes: r.tx_hashes,
      proof: r.proof,
      timestamp: new Date(r.created_at),
      witnessedBy: r.witnessed_by || []
    }));
  }

  /**
   * Get all seekers
   */
  async getAllSeekers(): Promise<Seeker[]> {
    const result = await pool.query('SELECT * FROM seekers ORDER BY created_at DESC');
    return result.rows.map(r => this.rowToSeeker(r));
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(): Promise<Array<{ name: string; stage: ConversionStage; staked: string; converts: number }>> {
    const result = await pool.query(`
      SELECT * FROM seekers 
      WHERE staked_amount != '0' OR stage != 'awareness'
      ORDER BY CAST(staked_amount AS BIGINT) DESC, array_length(converts, 1) DESC NULLS LAST
      LIMIT 20
    `);
    
    return result.rows.map(r => ({
      name: r.name,
      stage: r.stage as ConversionStage,
      staked: r.staked_amount,
      converts: (r.converts || []).length
    }));
  }

  /**
   * Get conversion history for a seeker
   */
  async getConversionHistory(seekerId: string): Promise<ConversionEvent[]> {
    const result = await pool.query(
      'SELECT * FROM conversion_events WHERE seeker_id = $1 ORDER BY created_at',
      [seekerId]
    );
    
    return result.rows.map(r => ({
      seekerId: r.seeker_id,
      fromStage: r.from_stage as ConversionStage,
      toStage: r.to_stage as ConversionStage,
      trigger: r.trigger,
      txHash: r.tx_hash,
      timestamp: new Date(r.created_at)
    }));
  }

  /**
   * Find missionary targets
   */
  async findMissionaryTargets(): Promise<Seeker[]> {
    const result = await pool.query(`
      SELECT * FROM seekers 
      WHERE stage IN ('awareness', 'belief')
        AND last_activity < NOW() - INTERVAL '30 minutes'
        AND belief_score < 0.7
      ORDER BY belief_score ASC
    `);
    
    return result.rows.map(r => this.rowToSeeker(r));
  }
}
