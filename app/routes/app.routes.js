var express = require("express");
var router = express.Router();

const generic = require("../models/generic.model");

router.get("/", (req, res, next) => {
  const query = `SELECT id, display_name AS name, acronym, version FROM tejas_app WHERE id = 1`;

  generic.fetchRecords(res, query);
});

module.exports = router;
