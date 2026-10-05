const router = require('express').Router();
const { loadPublicExam } = require('../services/publicCatalogue');

router.get('/:family/:examId', async (req, res) => {
  try {
    const data = await loadPublicExam(req.params.family, req.params.examId);
    if (!data) return res.status(404).json({ message: 'This exam could not be found.' });
    res.set('Cache-Control', 'public, max-age=30');
    return res.json(data);
  } catch {
    return res.status(503).json({ message: 'We could not check test availability. Please try again.' });
  }
});

module.exports = router;
