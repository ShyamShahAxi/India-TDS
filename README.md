# India-TDS

Monthly TDS review for AXI Technologies India and AXI Digital India.

`tds-challan-desk.html` is a single-page dashboard with six tabs: Overview, Challan, GL reconciliation, Certificates & 194Q, Earlier months, and Files & rules. Open it in a browser, pick the entity, and upload the Concur invoice extract and bank statement for the month. It works out TDS by section and payment code under section 393 of the Income-tax Act, 2025, checks the deductions against the bank payments, tracks lower deduction certificates and 194Q goods purchases, and compares the month with the advisor's earlier summaries.

The WHT payable GL section reconciles account 250500 (Sage Intacct General Ledger report, AUS045 for AXI Technologies and AUS055 for AXI Digital). Upload the GL report for the selected entity. Each month-end balance is matched in INR to the challan that clears it, and anything that doesn't clear is carried as an item to reconcile. That includes the AXI Technologies opening difference from FY 2025-26.

Files are read in the browser and are not sent anywhere.
