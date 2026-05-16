const express = require('express');
const router = express.Router();
const trackerController = require('../controllers/trackerController');

router.post('/track', trackerController.trackBus);
router.get('/bus/location', trackerController.getLocations);
router.get('/bus-plates', trackerController.getBusPlates);
router.get('/bus/:bus_id/logs', trackerController.getBusLogs);

module.exports = router;
