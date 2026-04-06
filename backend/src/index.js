const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const subprojectRoutes = require('./routes/subprojects');
const timeEntryRoutes = require('./routes/timeEntries');
const reportRoutes = require('./routes/reports');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

async function start() {
  const db = await initDatabase();

  app.use((req, res, next) => {
    req.db = db;
    next();
  });

  app.use('/api/clients', clientRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/subprojects', subprojectRoutes);
  app.use('/api/time-entries', timeEntryRoutes);
  app.use('/api/reports', reportRoutes);

  app.listen(PORT, () => {
    console.log(`Backend draait op http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Fout bij opstarten:', err);
  process.exit(1);
});
