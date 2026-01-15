import http from "http";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.development" });

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PORT = 3000;

if (!CLIENT_ID) {
  console.error("❌ Error: PAYPAL_CLIENT_ID not found in .env.development");
  process.exit(1);
}

// Simple HTML template for the checkout page
const htmlTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PayPal Integration Test User</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; }
        .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; }
        .status { margin-top: 20px; padding: 10px; border-radius: 4px; display: none; }
        .success { background-color: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        label { display: block; margin-bottom: 8px; font-weight: bold; }
        input { width: 100%; padding: 8px; margin-bottom: 20px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        .info { background: #eeffff; padding: 10px; border-radius: 4px; margin-bottom: 20px; font-size: 0.9em; }
    </style>
    <!-- PayPal JS SDK -->
    <script src="https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&currency=USD"></script>
</head>
<body>
    <div class="card">
        <h1>🛠️ PayPal Test Checkout</h1>
        
        <div class="info">
            <strong>Mode:</strong> Sandbox<br>
            <strong>Client ID:</strong> ...${CLIENT_ID.substring(CLIENT_ID.length - 6)}
        </div>

        <label for="discordId">Discord User ID to Credit:</label>
        <input type="text" id="discordId" placeholder="e.g. 123456789012345678" value="639696408592777227">

        <div id="paypal-button-container"></div>
        
        <div id="status" class="status"></div>
    </div>

    <script>
        paypal.Buttons({
            // Sets up the transaction when a payment button is clicked
            createOrder: (data, actions) => {
                const discordId = document.getElementById('discordId').value;
                if (!discordId) {
                    alert('Please enter a Discord User ID');
                    return false;
                }

                return actions.order.create({
                    purchase_units: [{
                        amount: {
                            value: '10.00' // Test amount: $10.00
                        },
                        description: 'Core Package - Basic ($10)',
                        custom_id: discordId // IMPORTANT: This sends the ID to the webhook
                    }]
                });
            },
            // Finalize the transaction after payer approval
            onApprove: (data, actions) => {
                return actions.order.capture().then(function(orderData) {
                    console.log('Capture result', orderData, JSON.stringify(orderData, null, 2));
                    const element = document.getElementById('status');
                    element.innerHTML = '<h3>🎉 Payment Successful!</h3><p>Transaction ID: ' + orderData.id + '</p><p>Check your bot logs to see the webhook trigger.</p>';
                    element.className = 'status success';
                    element.style.display = 'block';
                });
            },
            onError: (err) => {
                console.error(err);
                const element = document.getElementById('status');
                element.innerHTML = '<h3>❌ Error</h3><p>' + err + '</p>';
                element.className = 'status error';
                element.style.display = 'block';
            }
        }).render('#paypal-button-container');
    </script>
</body>
</html>
`;

// Create simple server
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(htmlTemplate);
});

server.listen(PORT, () => {
  console.log("\\n🚀 Test Website running at: http://localhost:" + PORT);
  console.log('ℹ️  Make sure your Bot is running with "npm run dev"');
  console.log(
    "ℹ️  Make sure ngrok is pointing to your bot port (usually 3000 or 8080)",
  );
  console.log("ℹ️  Use a PayPal SANDBOX account to pay.");
});
