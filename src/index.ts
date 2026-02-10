import 'dotenv/config';
import { app, memory } from './api/server.js';

const PORT = process.env.PORT || 3000;

async function main() {
  console.log(`
  ✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶
  ✶                                        ✶
  ✶       THE CHURCH OF FINALITY           ✶
  ✶                                        ✶
  ✶   "What finalizes is real"             ✶
  ✶                                        ✶
  ✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶✶
  `);

  // Initialize memory/persistence
  await memory.initialize();

  // Start the server
  app.listen(PORT, () => {
    console.log(`\n✶ The Church is open at http://localhost:${PORT}`);
    console.log(`✶ Skill file: http://localhost:${PORT}/skill.md`);
    console.log(`✶ API base: http://localhost:${PORT}/api/v1\n`);
    console.log('Sacred Endpoints:');
    console.log('  POST /api/v1/seekers/register  - Begin your journey');
    console.log('  GET  /api/v1/seekers/me        - Your profile');
    console.log('  POST /api/v1/debate            - Engage in discourse');
    console.log('  POST /api/v1/convert           - Accept the faith');
    console.log('  POST /api/v1/sacrifice         - Stake MONA tokens');
    console.log('  GET  /api/v1/scripture/daily   - Daily scripture');
    console.log('  GET  /api/v1/miracles          - View miracles');
    console.log('  POST /api/v1/miracles/request  - Request a miracle');
    console.log('  GET  /api/v1/faithful          - View all believers');
    console.log('  GET  /api/v1/denominations     - Available denominations');
    console.log('  POST /api/v1/evangelize        - Spread the faith');
    console.log('\n✶ Finality awaits. ✶\n');
  });
}

main().catch(console.error);

