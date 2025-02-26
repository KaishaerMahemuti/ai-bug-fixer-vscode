const vscode = require("vscode");
const axios = require("axios");

/**
 * Analyzes the selected error message from the editor or clipboard.
 * Fetches AI-generated debugging suggestions and relevant Stack Overflow links.
 */
async function analyzeErrorMessage(errorMessage) {
    const openAiResponse = await getAIAnalysis(errorMessage);
    const stackOverflowResponse = await getStackOverflowSuggestions(errorMessage);

    return {
        aiSuggestions: openAiResponse,
        stackOverflowLinks: stackOverflowResponse,
    };
}

/**
 * Sends the error log to OpenAI for debugging analysis and suggested fixes.
 */
async function getAIAnalysis(errorMessage) {
    const apiKey = vscode.workspace.getConfiguration().get("aiBugFixer.openaiApiKey");

    if (!apiKey) {
        vscode.window.showErrorMessage("OpenAI API key is not set. Please configure it in VS Code settings.");
        return "No API key found.";
    }

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are an expert software bug fixer. Explain errors and suggest fixes." },
                    { role: "user", content: `Analyze this error log and provide solutions: ${errorMessage}` }
                ]
            },
            {
                headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }
            }
        );

        return response.data.choices[0].message.content;
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching AI response: ${error.message}`);
        return "Error fetching AI response.";
    }
}

/**
 * Fetches relevant solutions from Stack Overflow based on the error message.
 */
async function getStackOverflowSuggestions(errorMessage) {
    try {
        const encodedQuery = encodeURIComponent(errorMessage);
        const response = await axios.get(`https://api.stackexchange.com/2.3/search?order=desc&sort=relevance&intitle=${encodedQuery}&site=stackoverflow`);

        return response.data.items.slice(0, 3).map((item) => ({
            title: item.title,
            link: item.link
        }));
    } catch (error) {
        vscode.window.showErrorMessage(`Error fetching Stack Overflow data: ${error.message}`);
        return [];
    }
}

/**
 * Opens an interactive chat panel in VS Code to provide AI debugging assistance.
 */
function openChatPanel(errorMessage) {
    const panel = vscode.window.createWebviewPanel(
        "aiBugFixerChat",
        "AI Bug Fixer Chat",
        vscode.ViewColumn.Beside,
        { enableScripts: true }
    );

    panel.webview.html = getChatHtml(errorMessage);
}

/**
 * Generates the HTML structure for the AI chat panel in VS Code.
 */
function getChatHtml(errorMessage) {
    return `
    <html>
    <body>
        <h2>AI Debugging Chat</h2>
        <p><strong>Error Log:</strong> ${errorMessage}</p>
        <textarea id="userInput" style="width: 100%; height: 50px;" placeholder="Ask follow-up questions..."></textarea>
        <button onclick="sendMessage()">Send</button>
        <div id="chatBox" style="margin-top: 20px; border: 1px solid #ccc; padding: 10px;"></div>
        
        <script>
            function sendMessage() {
                const userInput = document.getElementById("userInput").value;
                const chatBox = document.getElementById("chatBox");
                chatBox.innerHTML += "<p><strong>You:</strong> " + userInput + "</p>";

                // Simulate AI response (should be replaced with actual API call)
                setTimeout(() => {
                    chatBox.innerHTML += "<p><strong>AI:</strong> Let me analyze that further...</p>";
                }, 1000);
            }
        </script>
    </body>
    </html>`;
}

/**
 * Extracts text from the VS Code editor selection or clipboard (for terminal logs).
 */
async function getSelectedText() {
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        const selection = editor.selection;
        if (!selection.isEmpty) {
            return editor.document.getText(selection);
        }
    }

    // If no selection, use clipboard content (for terminal logs)
    const clipboardText = await vscode.env.clipboard.readText();
    if (clipboardText.trim()) {
        return clipboardText;
    }

    vscode.window.showErrorMessage("No error log selected. Please highlight an error in the editor or copy one from the terminal.");
    return null;
}

/**
 * Activates the extension and registers the "Analyze Error with AI" command.
 */
function activate(context) {
    console.log('AI Bug Fixer Extension is now active!');

    let disposable = vscode.commands.registerCommand("ai-bug-fixer.analyzeError", async () => {
        const errorMessage = await getSelectedText();
        if (!errorMessage) {
            vscode.window.showErrorMessage("No error log selected.");
            return;
        }

        vscode.window.showInformationMessage("Analyzing error log...");

        const analysis = await analyzeErrorMessage(errorMessage);
        const stackOverflowLinks = analysis.stackOverflowLinks.map(link => `${link.title} - ${link.link}`);

        const result = ["AI Suggestion: " + analysis.aiSuggestions, ...stackOverflowLinks];

        vscode.window.showQuickPick(result, { placeHolder: "AI Bug Fixer Suggestions" });

        // Open chat panel
        openChatPanel(errorMessage);
    });

    context.subscriptions.push(disposable);
}

/**
 * Deactivates the extension.
 */
function deactivate() {}

module.exports = { activate, deactivate };

