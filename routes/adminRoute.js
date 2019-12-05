const router = require("express").Router();

const BanksModel = require("../models/Allbanks");
const FLW_calls = require("../middleware/FLW_calls");
const helperFunctions = require("../middleware/helperFunctions");

router.get("/getbanks", async (req, res) => {
  const allBanks = await FLW_calls.getAllBanks();
  if (allBanks.status === "success") {
    banksArray = allBanks.data.Banks;

    const prevBanks = await BanksModel.find({ status: 1 });
    if (prevBanks.length === 0) {
      const setBanks = new BanksModel({
        status: 1,
        banks: banksArray,
        lastUpdated: new Date()
      });
      const saveBank = await setBanks.save();
      if (saveBank) {
        return res.status(200).json({ msg: "banks created" });
      }
    } else {
      console.log("yaa");
      const updateBank = await BanksModel.updateOne(
        { id: prevBanks.id },
        { banks: banksArray }
      );
      console.log(updateBank);
      if (updateBank.n > 0) {
        return res.status(200).json({ msg: "banks updated" });
      }
    }
  }
});
router.get("/set", async (req, res) => {
  const resp = await helperFunctions.runSettlements();
  res.json(resp);
});

router.get("/get-all-transfers", async (req, res) => {
  const resp = await FLW_calls.listTransfers();
  res.json(resp);
});
router.get("/get-successful-transfers", async (req, res) => {
  const resp = await FLW_calls.listTransfers("successful");
  res.json(resp);
});
router.get("/get-failed-transfers", async (req, res) => {
  const resp = await FLW_calls.listTransfers("failed");
  res.json(resp);
});
router.get("/get-fees", async (req, res) => {
  const resp = await FLW_calls.getTransferFee();
  res.json(resp);
});
module.exports = router;
