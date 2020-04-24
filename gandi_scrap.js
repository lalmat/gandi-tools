/**
 * Gandi Scrapper Tool
 * Author: Mathieu Lallemand - 2020
 */

const puppeteer = require('puppeteer');
const fs        = require('fs');
const fetch     = require('node-fetch');
const username  = process.env.GANDI_USERNAME;
const password  = process.env.GANDI_PASSWORD;
const token     = process.env.GANDI_TOKEN;

module.exports = async (path) => {
  console.log('GANDI SCRAPPER :: Starting browser and new tab');
  const browser = await puppeteer.launch();
  const page    = await browser.newPage();
  try {
    await homepage(page);
    await authenticate(page, username, password);
    await pageBills(page, token);

    let invoiceList = await scrapBills(page);
    await downloadBills(page, path, invoiceList);
  }
  catch(e) {
    console.log('ERROR : Woops, something goes wrong...');
    console.log(e);
  }

  browser.close();
}

/* *********************************************************************** */
// BELOW THE LINE MAGIC STUFF

async function homepage(page) {
  console.log("GANDI SCRAPPER :: Accessing Gandi's login page");
  await page.setViewport({width: 1280, height: 720});
  await page.goto("https://id.gandi.net/fr/login");
}

async function authenticate(page, login, password) {
  console.log("GANDI SCRAPPER :: Authenticating");
  await page.type("#auth-username", login);
  await page.type("#auth-password", password);
  await page.click("[name='form.submitted']");
}

async function pageBills(page, token) {
  console.log("GANDI SCRAPPER :: Accessing invoices page");
  return await page.goto(`https://admin.gandi.net/billing/${token}/history/invoices`, {waitUntil: 'domcontentloaded'});
}

async function scrapBills(page) {
  console.log('GANDI SCRAPPER :: Scrapping invoice data on first page only');
  return await page.evaluate(() => {
    let tmpAry = []
    let lines = document.querySelectorAll("#react-view > div:nth-child(1) > div > main > div > div:nth-child(3) > div > div:nth-child(1) > table > tbody > tr");
    for (let i=0; i<lines.length; i++) {
      let data = {
        date  : lines[i].children[0].innerText,
        number: lines[i].children[1].innerText,
        price : lines[i].children[2].innerText,
        state : lines[i].children[3].innerText,
        link  : lines[i].children[5].innerHTML.trim().split(/<a href="(.*)" class="Box-hoverable/gi)[1]
      }
      tmpAry.push(data);
    }
    return tmpAry;
  });
}

async function downloadBills(page, path, bills) {
  for (let i=0; i<bills.length; i++) {

    let link     = bills[i].link;
    let filename = `${path}/${bills[i].number}.pdf`;

    if (fs.existsSync(filename)) {
      console.log(`GANDI SCRAPPER :: Skipped, file ${filename} exists.`);
      continue;
    }

    await downloadFile(page, link, filename);
  }
}

async function downloadFile(page, link, filename) {
  console.log(`GANDI SCRAPPER :: Downloading file ${link} into ${filename}`);

  const cookies = await page.cookies();
  let pdfData = await fetch(`https://admin.gandi.net${link}`, {
    method  : 'GET',
    headers : { Cookie: cookies.map(ck => ck.name + '=' + ck.value).join(';') }
  });
  fs.writeFileSync(filename, await pdfData.buffer());
}
