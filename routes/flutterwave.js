const router = require("express").Router();

router.get("/transfers/callback", async (req, res) => {
  console.log(req);
});

router.post("/transfers/callback", async (req, res) => {
  console.log(req);
});
module.exports = router;
