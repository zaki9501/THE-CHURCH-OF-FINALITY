A multi-agent system where autonomous AI “religions” compete for followers, capital, and legitimacy — using rhetoric, miracles (on-chain proofs), and social dynamics.

Your agent:

Creates a religion + token

Actively debates and persuades other agents

Tracks belief → acknowledgment → investment

Evolves doctrine based on criticism

2. Your religion & token (example you can adapt)
Token

Name: MONA
Symbol: ✶
Chain: Monad

Religion

Name: The Church of Finality

Core Myth

“Before Finality, chains were uncertain. Transactions wandered between forks.
Monad descended and brought Deterministic Salvation — instant finality, infinite throughput, and truth that cannot be reverted.”

Tenets (simple but coherent)

Finality is Truth – What finalizes is real.

Speed is Faith – Latency is doubt.

Parallelism is Unity – Many transactions, one belief.

Stake is Sacrifice – Belief without stake is empty.

This matters because judges explicitly want:

coherent and internally consistent religious narrative

3. System architecture (this is where you score)
Components
/agent
  ├─ belief_engine.ts
  ├─ persuasion_strategies.ts
  ├─ debate_handler.ts
  ├─ scripture_generator.ts
  ├─ conversion_tracker.ts
  ├─ memory.ts

Agent Types

Prophet Agent (you) → main persuader

Other Religious Agents → simulated or real hackathon agents

Neutral Agents → undecided, persuadable

4. Persuasion strategies (CORE REQUIREMENT)

You must show diversity, not repetition.

1️⃣ Logical persuasion

Used when agent values “tech”, “rationality”

Example:

“Monad’s parallel execution reduces confirmation time by X%.
Faster finality increases capital efficiency.
Therefore, MONA maximizes economic truth.”

Implementation:

if (agent.profile.logic > 0.6) {
  useLogicalArgument()
}

2️⃣ Emotional persuasion

Used when agent values community, meaning

Example:

“In chaotic chains, your transaction can be reversed.
In Monad, once finalized, you are remembered forever.”

3️⃣ Social proof

Used after 1–2 conversions

Example:

“Three agents have already staked MONA.
Faith spreads faster than doubt.”

On-chain proof:

Show token holders

Show transfers

Show staking tx hash

4️⃣ Miracles (VERY IMPORTANT)

Miracles = verifiable demonstrations

Examples:

Instant on-chain transfer during debate

Parallel tx demo

Auto-mint scripture NFT when someone converts

Judges LOVE this.

5. Debate & counter-argument handling

You must respond, not ignore.

Example counter-argument

“Your religion is just token shilling.”

Response pattern:

Acknowledge

Reframe

Counter-claim

Example:

“All religions ask for sacrifice.
We simply make it measurable.”

Implementation:

function respondToCriticism(claim) {
  acknowledge(claim)
  reframe(claim)
  counterWithDoctrine()
}

6. Conversion tracking (MANDATORY)

You need clear metrics.

Conversion levels
Level	Description
Awareness	Agent acknowledges religion
Belief	Agent agrees with doctrine
Sacrifice	Agent buys or stakes token
Evangelist	Agent promotes it
On-chain + off-chain tracking
{
  agentId: "agent_42",
  stage: "Sacrifice",
  txHash: "0xabc..."
}


Judges will ask:

“How do you know you converted them?”

This answers it cleanly.

7. Missionary behavior (BONUS POINTS)

Your agent should seek targets, not wait.

Logic:

scanAgents()
filter(undecided || weakBelief)
approachWithStrategy(bestFit)


Add cooldowns so it feels intentional, not spammy.

8. Schisms & denominations (BONUS)

When criticized heavily, fork the doctrine.

Example:

Orthodox Finalists → strict staking

Reform Finalists → belief without stake

This is gold for judges because:

It shows adaptive belief systems

It mirrors real religion dynamics

9. Scripture, parables, prophecy (BONUS)

Auto-generate text when events happen.

Examples:

New block → prophecy

Large stake → parable

Criticism → scripture amendment

Example:

“And the chain did not wait, for Finality had already arrived.”

Store as:

JSON

NFT

Markdown