require('dotenv').config();

const scrapper = require('./gandi_scrap.js');

scrapper(__dirname+"/invoices");
