async function run() {
  // First add stock
  await fetch("http://127.0.0.1:3000/api/ai/voice-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "100 water add karo",
      sellerName: "Test AI"
    })
  });

  // Now make sale
  const res = await fetch("http://127.0.0.1:3000/api/ai/voice-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "5 ki sale daal do water ki",
      sellerName: "Test AI"
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

run();
