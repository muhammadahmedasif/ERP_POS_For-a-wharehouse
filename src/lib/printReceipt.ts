export const printReceipt = (sale: any, products: any[], settings: any = {}) => {
  // Remove any previously created printing iframe to prevent DOM clutter
  const existingFrame = document.getElementById('receipt-print-iframe');
  if (existingFrame) {
    existingFrame.parentNode?.removeChild(existingFrame);
  }

  // Create a quiet, completely invisible iframe
  const iframe = document.createElement('iframe');
  iframe.id = 'receipt-print-iframe';
  iframe.setAttribute('style', 'position: absolute; width: 0; height: 0; border: none; left: -9999px; top: -9999px;');
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    console.error("Could not obtain iframe document for billing receipt.");
    return false;
  }

  const storeName = settings.storeName || 'ZAHID WHOLESALE';
  const taxRate = settings.taxRate || 0;
  
  const subtotal = sale.items.reduce((acc: number, item: any) => acc + (item.quantity * item.price), 0);

  // Format date, day, and time dynamically and correctly
  const d = new Date(sale.date);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = isNaN(d.getTime()) ? 'Thursday' : days[d.getDay()];
  const dateStr = isNaN(d.getTime()) ? sale.date : d.toISOString().split('T')[0];
  
  let timeStr = '12:00 PM';
  if (!isNaN(d.getTime())) {
    try {
      timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (err) {
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutesStr = minutes < 10 ? '0' + minutes : minutes;
      timeStr = `${hours}:${minutesStr} ${ampm}`;
    }
  }

  const itemsHtml = sale.items.map((item: any) => {
    const p = products.find((prod: any) => prod.id === item.productId);
    const name = p ? p.name : `ITEM-${item.productId}`;
    return `
      <tr>
        <td style="text-align: left; padding: 5px 0; font-weight: bold; border-bottom: 1px dotted #ccc;">${name}</td>
        <td style="text-align: center; padding: 5px 0; border-bottom: 1px dotted #ccc;">${item.quantity}</td>
        <td style="text-align: right; padding: 5px 0; border-bottom: 1px dotted #ccc;">Rs. ${item.price.toFixed(2)}</td>
        <td style="text-align: right; padding: 5px 0; border-bottom: 1px dotted #ccc;">Rs. ${(item.quantity * item.price).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${sale.id}</title>
        <style>
          body {
            font-family: 'Courier New', Courier, monospace;
            width: 72mm; /* Best fit for 80mm printers to avoid margins cutting off */
            margin: 0 auto;
            padding: 5px 2mm;
            font-size: 12px;
            color: #000;
            background: #fff;
          }
          h1 {
            text-align: center;
            font-size: 18px;
            margin: 0 0 5px 0;
            text-transform: uppercase;
            font-weight: bold;
            border-bottom: 1px dashed #000;
            padding-bottom: 5px;
          }
          h2 {
            text-align: center;
            font-size: 11px;
            margin: 0 0 10px 0;
            font-weight: normal;
            letter-spacing: 1px;
          }
          .info {
            font-size: 11px;
            margin-bottom: 12px;
            text-align: left;
            line-height: 1.4;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin: 10px 0;
          }
          .items-table th {
            border-bottom: 1px dashed #000;
            padding: 5px 0;
            font-weight: bold;
            text-transform: uppercase;
          }
          .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 5px;
          }
          .summary-table td {
            padding: 3px 0;
          }
          .total {
            font-weight: bold;
            font-size: 13px;
          }
          .total-line {
            border-top: 1px dashed #000;
            border-bottom: 1px dashed #000;
            padding: 6px 0 !important;
          }
          .footer {
            text-align: center;
            margin-top: 25px;
            font-size: 10px;
            line-height: 1.4;
          }
          @media print {
            body { 
              padding: 0;
              margin: 0;
              width: 100%;
            }
            @page {
              margin: 0;
            }
          }
        </style>
      </head>
      <body>
        <h1>${storeName}</h1>
        <h2>TAX INVOICE</h2>
        <div class="info">
          <div><strong>Bill ID :</strong> ${sale.id}</div>
          ${sale.customerName ? `<div><strong>Customer:</strong> ${sale.customerName}</div>` : ''}
          <div><strong>Seller:</strong> ${sale.sellerName || 'N/A'}</div>
          <div><strong>Day     :</strong> ${dayName}</div>
          <div><strong>Date    :</strong> ${dateStr}</div>
          <div><strong>Time    :</strong> ${timeStr}</div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: left; width: 40%;">ITEM</th>
              <th style="text-align: center; width: 15%;">QTY</th>
              <th style="text-align: right; width: 22%;">RATE</th>
              <th style="text-align: right; width: 23%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table class="summary-table">
          <tr>
            <td style="text-align: left;">Subtotal</td>
            <td style="text-align: right;">Rs. ${subtotal.toFixed(2)}</td>
          </tr>
          ${sale.discountAmount && sale.discountAmount > 0 ? `
          <tr>
            <td style="text-align: left; color: #000; font-weight: bold;">Discount</td>
            <td style="text-align: right; font-weight: bold;">- Rs. ${parseFloat(sale.discountAmount).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; font-style: italic;">Disc. Subtotal</td>
            <td style="text-align: right; font-style: italic;">Rs. ${Math.max(0, subtotal - sale.discountAmount).toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="text-align: left;">Tax (${taxRate}%)</td>
            <td style="text-align: right;">Rs. ${(sale.discountAmount && sale.discountAmount > 0 ? (Math.max(0, subtotal - sale.discountAmount) * taxRate / 100) : (subtotal * taxRate / 100)).toFixed(2)}</td>
          </tr>
          <tr class="total">
            <td class="total-line" style="text-align: left;">TOTAL PAYABLE</td>
            <td class="total-line" style="text-align: right;">Rs. ${sale.total.toFixed(2)}</td>
          </tr>
          ${sale.creditDeducted && sale.creditDeducted > 0 ? `
          <tr>
            <td style="text-align: left; padding-top: 6px;">Paid via Advance</td>
            <td style="text-align: right; padding-top: 6px; font-weight: bold;">- Rs. ${parseFloat(sale.creditDeducted).toFixed(2)}</td>
          </tr>
          ` : ''}
          ${sale.customerId ? `
          <tr>
            <td style="text-align: left;">Cash Received</td>
            <td style="text-align: right; font-weight: bold;">Rs. ${(sale.amountPaid || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="text-align: left; font-weight: bold; border-top: 1px dotted #000; padding: 4px 0;">Outstanding Due</td>
            <td style="text-align: right; font-weight: bold; border-top: 1px dotted #000; padding: 4px 0;">Rs. ${Math.max(0, sale.total - (sale.amountPaid || 0) - (sale.creditDeducted || 0)).toFixed(2)}</td>
          </tr>
          ` : ''}
        </table>
        
        <div class="footer">
          Thank you for your business!<br/>
          Please come again!
        </div>
      </body>
    </html>
  `;

  doc.write(html);
  doc.close();

  // Highlight iframe container and trigger focused standard printing overlay
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error("Frame printing triggered error:", e);
    }
  }, 20);

  return true;
};
