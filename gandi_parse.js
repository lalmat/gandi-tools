const fs   = require('fs');
const pdf  = require('pdf-parse');
const path = require('path');

module.exports = async (invoices_path) => {

    let files = fs.readdirSync(invoices_path);

    for (file of files) {
        let filepath = `${invoices_path}\/${file}`;
        let filejson = path.dirname(filepath) + "/" + path.basename(filepath, '.pdf') + '.json';

        if (path.extname(filepath) != ".pdf") continue;
        if (fs.existsSync(filejson)) continue;

        console.log(`GANDI PARSER :: Parsing ${file}`);
        let dataBuffer = fs.readFileSync(filepath);
        let data       = await pdf(dataBuffer, {pagerender: render_page});
        let parseData  = data.text.split('\n');

        console.log(`GANDI PARSER :: Interpreting parsed datas`);
        let invoiceJSON = parseJSON(parseData);

        console.log(`GANDI PARSER :: Saving JSON to file`);

        fs.writeFileSync(filejson, JSON.stringify(invoiceJSON));
    }

    async function render_page(pageData) {

        let render_options = {
            normalizeWhitespace: false,
            disableCombineTextItems: false
        }

        let textContent = await pageData.getTextContent(render_options);
        let lastY = null;
        let text  = '';

        for (let item of textContent.items) {
            if (lastY == item.transform[5] || !lastY){
                text += ";"+item.str;
                lastY = item.transform[5];
                continue;
            }
            text += '\n' + item.str;
            lastY = item.transform[5];
        }
        return text;
    }

    function parseJSON(data) {
        let invoice = {}

        for (let i=0; i<data.length; i++) {
            let line = data[i].split(";");

            if (line[0] == "Facture n°") { invoice.number = line[2]; continue; }
            if (line[0] == "Statut :")   { invoice.state  = line[2]; continue; }
            if (line[0] == "Date :")     { invoice.date   = line[2]; continue; }

            if (line[0] == "De :") {
                invoice.sender = {
                    name     : data[i+1].split(';')[0],
                    address  : data[i+2].split(';')[0],
                    postcode : data[i+3].split(';')[0],
                    city     : data[i+3].split(';')[2],
                    country  : data[i+4]
                };
                i += 4;
            }

            if (line[0] == "Pour :") {
                invoice.recipient = {
                    name     : data[i+1].split(';')[0],
                    address  : data[i+2].split(';')[0],
                    postcode : data[i+3].split(';')[0],
                    city     : data[i+3].split(';')[2],
                    country  : data[i+4],
                    tva      : data[i+5],
                    email    : data[i+6]
                };
                i += 6;
            }

            if (line[0] == 'Produit') {
                invoice.products = [];
                let j = 1;

                while (data[i+j] != "Total (Hors taxes)") {
                    let productLine = data[i+j].split(";");
                    invoice.products.push({
                        name        : productLine[0],
                        description : productLine[1],
                        account     : productLine[2],
                        tva         : productLine[3],
                        price       : productLine[4]
                    });
                    j++;
                }
                i += j;
            }

            if (line[0] == 'Total (TTC)') {
                invoice.total_notax = parseFloat(data[i+1].replace(',','.'));
                invoice.total_tax   = parseFloat(data[i+2].replace(',','.'));
                invoice.total       = parseFloat(data[i+3].replace(',','.'));
                invoice.devise      = "€"
                invoice.device_name = "EURO"
            }
        }

        return invoice;
    }
}
