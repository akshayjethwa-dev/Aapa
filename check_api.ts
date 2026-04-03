async function check() {
    try {
        const res = await fetch('http://localhost:3000/api/market-status');
        const data = await res.json();
        console.log("Market Status:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Failed to fetch market status:", e.message);
    }
}
check();
