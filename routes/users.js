const router = require("express").Router();
const protectRoute = require("../middleware/auth");

router.get("/", protectRoute, (req, res) => res.json({ user: req.userid }));

module.exports = router;
