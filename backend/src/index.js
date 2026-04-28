const express = require('express');
const cors = require('cors');
const { initDatabase } = require('./database');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const subprojectRoutes = require('./routes/subprojects');
const timeEntryRoutes = require('./routes/timeEntries');
const reportRoutes = require('./routes/reports');
const costRoutes = require('./routes/costs');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const db = initDatabase();

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/subprojects', subprojectRoutes);
app.use('/api/time-entries', timeEntryRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/costs', costRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(PORT, () => {
  console.log(`Backend draait op http://localhost:${PORT}`);
});
