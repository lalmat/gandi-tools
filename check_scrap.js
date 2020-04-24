require('dotenv').config();

const scraper = require('./gandi_scrap.js');

scrapper(__dirname+"/invoices");
