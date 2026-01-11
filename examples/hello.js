// Example JavaScript/Node.js script
console.log("🚀 Hello from JavaScript!");
console.log("=".repeat(30));

// Variables and operations
const name = "AI-IDE";
const version = process.version;
console.log(`Running on Node.js ${version}`);
console.log(`Welcome to ${name}!`);

// Array operations
const numbers = [1, 2, 3, 4, 5];
const squares = numbers.map(n => n * n);
console.log(`Numbers: ${numbers}`);
console.log(`Squares: ${squares}`);

// Object/JSON example
const project = {
    name: "AI-IDE",
    language: "JavaScript",
    runtime: "Node.js",
    features: ["execution", "terminal", "real-time"]
};
console.log("Project info:", JSON.stringify(project, null, 2));

// Async example
setTimeout(() => {
    console.log("\n✅ JavaScript execution complete!");
}, 100);