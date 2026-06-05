async function run() {
  const res = await fetch("http://127.0.0.1:3000/api/ai/voice-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: "Ahmed ka 500 ka saman gaya hai add kar do us ke khate mein",
      sellerName: "Test AI"
    })
  });
  
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}

run();
