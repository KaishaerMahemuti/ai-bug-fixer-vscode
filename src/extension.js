const vscode = require("vscode");
const axios = require("axios");

async function analyzeErrorMessage(errorMessage) {
    const openAiResponse = await getAIAnalysis(errorMessage);
    const stackOverflowResponse = await getStackOverflowSuggestions(errorMessage);

    return {
        aiSuggestions: openAiResponse,
        stackOverflowLinks: stackOverflowResponse,
    };
}

async function getAIAnalysis(errorMessage) {
    const apiKey = vscode.workspace.getConfiguration().get("aiBugFixer.openaiApiKey");

    if (!apiKey) {
        vscode.window.showErrorMessage("OpenAI API key is not set. Please configure it in VS Code settings.");
        return "No API key found. Please set it in VS Code settings.";
    }

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are an expert software bug fixer." },
                    { role: "user", content: `Analyze this error message: ${errorMessage}` }
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

function activate(context) {
    console.log('🚀 AI Bug Fixer Extension is now active!');
    let disposable = vscode.commands.registerCommand("ai-bug-fixer.analyzeError", async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor found.");
            return;
        }

        const selection = editor.selection;
        const text = editor.document.getText(selection) || "No error message selected.";

        vscode.window.showInformationMessage("Analyzing error message...");

        const analysis = await analyzeErrorMessage(text);
        const stackOverflowLinks = analysis.stackOverflowLinks.map(link => `${link.title} - ${link.link}`);

        const result = ["AI Suggestion: " + analysis.aiSuggestions, ...stackOverflowLinks];

        vscode.window.showQuickPick(result, { placeHolder: "AI Bug Fixer Suggestions" });
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };
