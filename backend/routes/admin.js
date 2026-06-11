const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/logs', adminController.getLogs);
router.get('/geofences', adminController.getGeofences);
router.get('/geofence-events', adminController.getGeofenceEvents);

router.get('/drivers', adminController.getDrivers);
router.post('/drivers', adminController.createDriver);
router.delete('/drivers/:id', adminController.deleteDriver);
router.patch('/drivers/:id/reset-password', adminController.resetDriverPassword);
router.put('/drivers/:id', adminController.updateDriver);

router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;
