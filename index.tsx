
declare var JSZip: any; // Declare JSZip for TypeScript

// Ollama configuration
const OLLAMA_SERVER_URL = process.env.OLLAMA_SERVER_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:e4b';

// Stable Diffusion configuration
const SD_SERVER_URL = process.env.SD_SERVER_URL || 'http://localhost:7865';

// Check if services are available
let apiKeyOk = true; // Always true for local services
console.log(`Using Ollama server at: ${OLLAMA_SERVER_URL} with model: ${OLLAMA_MODEL}`);
console.log(`Using Stable Diffusion server at: ${SD_SERVER_URL}`);

// Declare DOM element variables - they will be assigned in the 'load' event
let chatLog: HTMLDivElement | null = null;
let userInput: HTMLTextAreaElement | null = null;
let actionChipsContainer: HTMLDivElement | null = null;
let contextualActionChipsContainer: HTMLDivElement | null = null;
let emptyChatPlaceholder: HTMLDivElement | null = null;
let chatContainer: HTMLDivElement | null = null;
let geminiInputBar: HTMLDivElement | null = null;

let customContextMenu: HTMLDivElement | null = null;
let contextMenuItemsList: HTMLUListElement | null = null;
let selectedTextForContextMenu: string | null = null;

// Gallery Sidebar Elements
let galleryItemsContainer: HTMLDivElement | null = null;
let imageGallerySidebar: HTMLElement | null = null;
let galleryToggleButton: HTMLButtonElement | null = null;
let downloadAllGalleryButton: HTMLButtonElement | null = null;

// Input Image Preview Elements
let inputImagePreviewContainer: HTMLDivElement | null = null;
let inputImagePreviewThumbnail: HTMLImageElement | null = null;
let inputImagePreviewRemoveButton: HTMLButtonElement | null = null;

console.log(`Using Ollama server at: ${OLLAMA_SERVER_URL} with model: ${OLLAMA_MODEL}`);
console.log(`Using Stable Diffusion server at: ${SD_SERVER_URL}`);

// Store conversation history for Ollama
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
let conversationHistory: Message[] = [];

interface ImageStyle {
  id: string;
  name: string;
  prefix: string;
  displayName: string; // For gallery card
}

const imageStyles: ImageStyle[] = [
  { id: "realistic", name: "📷 Realistic", prefix: "realistic photo of ", displayName: "Realistic Photo" },
  { id: "cartoon", name: "✏️ Cartoon", prefix: "old skool cartoon style drawing of ", displayName: "Old Skool Cartoon" },
  { id: "hyper", name: "✨ Hyper", prefix: "hyper realistic detailed image of ", displayName: "Hyper Realistic" },
  { id: "pixel", name: "👾 Pixel Art", prefix: "pixel art style image of ", displayName: "Pixel Art" },
  { id: "abstract", name: "🎨 Abstract", prefix: "abstract artistic interpretation of ", displayName: "Abstract Art" },
  { id: "tattoo", name: "💪 Tattoo", prefix: "Tattoo artistic interpretation of ", displayName: "Tattoo" },
  { id: "sand", name: "⛱️ Sand", prefix: "Sand art interpretation of ", displayName: "Sand" },
  { id: "fire", name: "🔥 Fire", prefix: "Fire interpretation of ", displayName: "Fire" },
  { id: "water", name: "💧 Water", prefix: "Water interpretation of ", displayName: "Water" },
  { id: "water", name: "🦧 Fur", prefix: "Fur interpretation of ", displayName: "Fur" },
];
interface ContextualAction {
    label: string;
    prompt: string;
    ariaLabel: string;
}

const contextualActionPrompts: ContextualAction[] = [
    { label: "🖼️ Describe", prompt: "Describe this image in detail.", ariaLabel: "Describe this image" },
    { label: "🤔 Explain", prompt: "Explain what is happening in this image.", ariaLabel: "Explain this image" },
    { label: "📝 Summarize", prompt: "Summarize this image concisely.", ariaLabel: "Summarize this image" },
    { label: "❓ Questions", prompt: "Suggest three interesting questions I could ask about this image.", ariaLabel: "Suggest questions about this image" },
    { label: "💡 Ideas", prompt: "Generate creative ideas based on this image.", ariaLabel: "Generate ideas from this image" },
];


interface GalleryImageInfo {
  id: string; // Unique ID (timestamp)
  imageUrl: string;
  prompt: string; // The full prompt sent to Imagen
  basePrompt: string; // The user's input part of the prompt
  modelName: string;
  generationTime: string;
  styleApplied: string; // "Realistic Photo", "Cartoon", "Direct Prompt", etc.
}

const MAX_GALLERY_ITEMS = 40;
let galleryItems: GalleryImageInfo[] = [];
let stagedImageForChat: { dataUrl: string; mimeType: string } | null = null;


function checkChatEmpty() {
  if (chatLog && emptyChatPlaceholder && chatContainer) {
    if (chatLog.children.length === 0) {
      emptyChatPlaceholder.style.display = 'flex';
      chatContainer.style.display = 'none';
    } else {
      emptyChatPlaceholder.style.display = 'none';
      chatContainer.style.display = 'flex';
    }
  }
}

interface AddUserMessageOptions {
    isImageRequest?: boolean;
    imageRequestId?: string;
    contextImageUrl?: string;
}

function addUserMessage(message: string, options: AddUserMessageOptions = {}): void {
  if (chatLog) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    if (options.isImageRequest) {
        messageElement.classList.add('user-image-request-message');
        if (options.imageRequestId) {
            messageElement.setAttribute('data-image-request-id', options.imageRequestId);
        }
    } else if (options.contextImageUrl) {
        messageElement.classList.add('user-message', 'user-message-with-context-image');
        const img = document.createElement('img');
        img.src = options.contextImageUrl;
        img.alt = "User provided image context";
        img.classList.add('user-prompt-image-thumbnail');
        messageElement.appendChild(img);
    }
    else {
        messageElement.classList.add('user-message');
    }

    const textElement = document.createElement('p');
    textElement.textContent = message;
    messageElement.appendChild(textElement);

    chatLog.appendChild(messageElement);
    scrollToBottom();
    checkChatEmpty();
  }
}

function addBotMessage(
    message: string,
    isThinking: boolean = false,
    isImageConfirmation: boolean = false,
    imageConfirmationId?: string
): HTMLDivElement | null {
  if (chatLog) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', 'bot-message');
    if (isThinking) {
      messageElement.classList.add('thinking-message');
    }
    if (isImageConfirmation && imageConfirmationId) {
        messageElement.setAttribute('data-bot-image-confirmation-id', imageConfirmationId);
    }
    message = message.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    messageElement.innerHTML = message; // Use innerHTML for link rendering
    chatLog.appendChild(messageElement);
    scrollToBottom();
    checkChatEmpty();
    return messageElement;
  }
  return null;
}

function extractBase64Data(dataUrl: string): { base64: string; mimeType: string } | null {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (match && match.length === 3) {
        return { mimeType: match[1], base64: match[2] };
    }
    if (!dataUrl.startsWith('data:')) {
        console.warn("Data URL does not have expected prefix. Assuming image/jpeg for base64 string if it's plain base64.");
        const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(dataUrl);
        if (looksLikeBase64) return { mimeType: 'image/jpeg', base64: dataUrl };
    }
    console.warn("Could not extract base64 data from dataUrl:", dataUrl.substring(0, 50) + "...");
    return null;
}


function getCardHTMLContent(item: GalleryImageInfo, localImageName: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image Card: ${item.basePrompt}</title>
        <style>
            body { font-family: sans-serif; margin: 20px; background-color: #f4f4f4; }
            .card { background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; max-width: 600px; margin: auto; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .card img { max-width: 100%; height: auto; border-radius: 4px; margin-bottom: 15px; }
            .metadata p { margin: 5px 0; }
            .metadata strong { color: #333; }
        </style>
    </head>
    <body>
        <div class="card">
            <img src="${localImageName}" alt="Generated image for prompt: ${item.basePrompt}">
            <div class="metadata">
                <p><strong>Prompt:</strong> ${item.basePrompt}</p>
                <p><strong>Style:</strong> ${item.styleApplied}</p>
                <p><strong>Model:</strong> ${item.modelName}</p>
                <p><strong>Generated:</strong> ${item.generationTime}</p>
                <p><strong>Full Prompt Used:</strong> ${item.prompt}</p>
            </div>
        </div>
    </body>
    </html>
  `;
}

function renderImageCard(item: GalleryImageInfo): HTMLElement {
  const card = document.createElement('div');
  card.classList.add('image-card');
  card.setAttribute('role', 'listitem');
  card.setAttribute('aria-labelledby', `card-prompt-${item.id}`);

  const metadata = document.createElement('div');
  metadata.classList.add('card-metadata');

  const promptField = document.createElement('div');
  promptField.classList.add('metadata-field');
  promptField.innerHTML = `<strong id="card-prompt-${item.id}">Prompt:</strong> <span>${item.basePrompt}</span>`;
  metadata.appendChild(promptField);

  const styleField = document.createElement('div');
  styleField.classList.add('metadata-field');
  styleField.innerHTML = `<strong>Style:</strong> <span>${item.styleApplied}</span>`;
  metadata.appendChild(styleField);

  const modelField = document.createElement('div');
  modelField.classList.add('metadata-field');
  modelField.innerHTML = `<strong>Model:</strong> <span>${item.modelName}</span>`;
  metadata.appendChild(modelField);

  const timeField = document.createElement('div');
  timeField.classList.add('metadata-field');
  timeField.innerHTML = `<strong>Generated:</strong> <span>${new Date(parseInt(item.id)).toLocaleTimeString()}</span>`;
  metadata.appendChild(timeField);

  const downloadButton = document.createElement('button');
  downloadButton.classList.add('download-image-button');
  downloadButton.textContent = 'Download Card';
  downloadButton.setAttribute('aria-label', `Download card with image and metadata for prompt: ${item.basePrompt}`);
  downloadButton.addEventListener('click', async () => {
    const zip = new JSZip();
    const extracted = extractBase64Data(item.imageUrl);
    let localImageName = "image.jpeg"; // Default
    if (extracted && extracted.mimeType) {
        const extension = extracted.mimeType.split('/')[1] || 'jpeg';
        localImageName = `image.${extension}`;
    }

    const cardHtmlContent = getCardHTMLContent(item, localImageName);
    zip.file("card_info.html", cardHtmlContent);

    if (extracted) {
       zip.file(localImageName, extracted.base64, { base64: true });
    }

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const safeStyle = item.styleApplied.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const safePrompt = item.basePrompt.substring(0,20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `card_${safeStyle}_${safePrompt}_${item.id}.zip`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    } catch (e) {
        console.error("Error generating individual zip file:", e);
        addBotMessage("⚠️ Sorry, there was an error creating the card archive.");
    }
  });
  metadata.appendChild(downloadButton);

  const imagePreview = document.createElement('div');
  imagePreview.classList.add('card-image-preview');
  const img = document.createElement('img');
  img.src = item.imageUrl;
  img.alt = `Generated image for prompt: ${item.basePrompt}`;
  img.draggable = true;
  img.addEventListener('dragstart', (event) => {
      if (event.dataTransfer) {
          event.dataTransfer.setData('application/json', JSON.stringify({ imageUrl: item.imageUrl, id: item.id }));
          event.dataTransfer.effectAllowed = 'copy';
      }
  });
  imagePreview.appendChild(img);

  card.appendChild(metadata);
  card.appendChild(imagePreview);
  return card;
}

function addOrUpdateGallery(item?: GalleryImageInfo) {
  if (!galleryItemsContainer || !apiKeyOk) return;

  if (item) {
    galleryItems.unshift(item);
    if (galleryItems.length > MAX_GALLERY_ITEMS) {
      galleryItems.pop();
    }
  }

  galleryItemsContainer.innerHTML = '';
  if (galleryItems.length === 0) {
      galleryItemsContainer.innerHTML = '<p style="color: var(--gemini-text-secondary); font-size: 0.9rem; text-align: center; padding-top: 20px;">No images generated yet.</p>';
      if (downloadAllGalleryButton) downloadAllGalleryButton.disabled = true;
  } else {
      galleryItems.forEach(galleryItem => {
        const cardElement = renderImageCard(galleryItem);
        galleryItemsContainer.appendChild(cardElement);
      });
      if (downloadAllGalleryButton) downloadAllGalleryButton.disabled = false;
  }
}

async function generateImageWithPrompt(basePrompt: string, fullPrompt: string, styleApplied: string = "Direct Prompt", imageRequestId?: string): Promise<void> {
  const thinkingMessage = addBotMessage(`🎨 Generating: "${basePrompt}" with style: ${styleApplied}, please wait...`, true);
  try {
    const response = await fetch(`${SD_SERVER_URL}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: fullPrompt,
        negative_prompt: "blurry, low quality, deformed, ugly",
        steps: 20,
        cfg_scale: 7,
        width: 512,
        height: 512,
        sampler_name: "Euler a",
        batch_size: 1,
        n_iter: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stable Diffusion API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (thinkingMessage && thinkingMessage.parentNode) {
      thinkingMessage.parentNode.removeChild(thinkingMessage);
    }

    if (data.images && data.images.length > 0) {
      const imageUrl = `data:image/png;base64,${data.images[0]}`;

      const botImageConfirmationId = `bot-confirm-${Date.now()}`;
      const confirmationMsg = addBotMessage(`🖼️ Image for "${basePrompt}" (${styleApplied}) generated and added to gallery.`, false, true, botImageConfirmationId);

      const galleryItem: GalleryImageInfo = {
        id: Date.now().toString(),
        imageUrl: imageUrl,
        prompt: fullPrompt,
        basePrompt: basePrompt,
        modelName: "Stable Diffusion",
        generationTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        styleApplied: styleApplied,
      };
      addOrUpdateGallery(galleryItem);

      if (imageRequestId && chatLog) {
        const userMessageToRemove = chatLog.querySelector(`[data-image-request-id="${imageRequestId}"]`);
        if (userMessageToRemove) userMessageToRemove.remove();
      }
      if (confirmationMsg) confirmationMsg.remove();
      checkChatEmpty();

    } else {
      addBotMessage(`⚠️ Sorry, I couldn't generate an image for "${basePrompt}". The API returned no images.`);
    }
  } catch (error) {
    console.error("Error generating image:", error);
    if (thinkingMessage && thinkingMessage.parentNode) {
      thinkingMessage.parentNode.removeChild(thinkingMessage);
    }
    let errorMessage = `⚠️ An error occurred while generating an image for "${basePrompt}".`;
    if (error instanceof Error) {
      if (error.message.includes("Failed to fetch")) {
        errorMessage += " Make sure Stable Diffusion web UI is running at " + SD_SERVER_URL;
      } else {
        errorMessage += " " + error.message;
      }
    }
    addBotMessage(errorMessage);
  }
}

const imageGenerationTriggers = ["generate image:", "create image of:", "draw:"];

async function handleChatInput(userMessage: string, imageForContext?: { dataUrl: string; mimeType: string }): Promise<void> {
    if (!apiKeyOk) {
        addBotMessage("⚠️ Local services not available.");
        return;
    }

    if (imageForContext) {
        addUserMessage(userMessage, { contextImageUrl: imageForContext.dataUrl });
        const thinkingMessage = addBotMessage("Thinking with image...", true);
        const imageDetails = extractBase64Data(imageForContext.dataUrl);

        if (!imageDetails) {
            if (thinkingMessage && thinkingMessage.parentNode) thinkingMessage.parentNode.removeChild(thinkingMessage);
            addBotMessage("⚠️ Sorry, there was an issue processing the provided image.");
            return;
        }

        if (thinkingMessage && thinkingMessage.parentNode) thinkingMessage.parentNode.removeChild(thinkingMessage);
        addBotMessage("⚠️ Image-context chat is not supported with local models. Please use text-only prompts.");
        return;
    } else {
        const lowerUserMessage = userMessage.toLowerCase();
        let imageBasePrompt: string | null = null;
        let triggerUsed: string | null = null;

        for (const trigger of imageGenerationTriggers) {
            if (lowerUserMessage.startsWith(trigger)) {
            imageBasePrompt = userMessage.substring(trigger.length).trim();
            triggerUsed = trigger;
            break;
            }
        }

        if (imageBasePrompt && triggerUsed) {
            const imageRequestId = `img-req-${Date.now()}`;
            addUserMessage(`Image Prompt: ${imageBasePrompt}`, { isImageRequest: true, imageRequestId });
            await generateImageWithPrompt(imageBasePrompt, imageBasePrompt, "Direct Prompt", imageRequestId);
        } else {
            addUserMessage(userMessage);
            const thinkingMessage = addBotMessage("Thinking...", true);
            try {
                // Add user message to conversation history
                conversationHistory.push({
                    role: 'user',
                    content: userMessage
                });

                // Call Ollama API
                const response = await fetch(`${OLLAMA_SERVER_URL}/api/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: OLLAMA_MODEL,
                        messages: conversationHistory,
                        stream: false
                    })
                });

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
                }

                const data: any = await response.json();
                const assistantMessage = data.message.content;

                // Add assistant message to conversation history
                conversationHistory.push({
                    role: 'assistant',
                    content: assistantMessage
                });

                if (thinkingMessage && thinkingMessage.parentNode) thinkingMessage.parentNode.removeChild(thinkingMessage);
                addBotMessage(assistantMessage);
            } catch (error) {
                console.error("Error sending chat message:", error);
                if (thinkingMessage && thinkingMessage.parentNode) thinkingMessage.parentNode.removeChild(thinkingMessage);
                let errorMessageText = "⚠️ An error occurred while trying to get a response. Please check the console.";
                if (error instanceof Error) {
                    if (error.message.includes("Failed to fetch")) {
                        errorMessageText = "⚠️ Could not connect to Ollama server. Make sure Ollama is running at " + OLLAMA_SERVER_URL;
                    } else if (error.message.includes("Ollama API error")) {
                        errorMessageText = "⚠️ Ollama server error: " + error.message;
                    }
                }
                addBotMessage(errorMessageText);
            }
        }
    }
}

function clearStagedImage() {
    stagedImageForChat = null;
    if (inputImagePreviewContainer) inputImagePreviewContainer.style.display = 'none';
    if (inputImagePreviewThumbnail) inputImagePreviewThumbnail.src = '#';
    if (contextualActionChipsContainer) {
        contextualActionChipsContainer.style.display = 'none';
        // console.log("Contextual chips hidden by clearStagedImage."); // Optional: for verbose debugging
    }
}

async function submitMessage(): Promise<void> {
  if (userInput && (userInput.value.trim() !== '' || stagedImageForChat)) {
    const messageText = userInput.value.trim();

    if (!apiKeyOk) {
        addBotMessage("⚠️ Local services not available.");
        if (userInput) userInput.value = '';
        clearStagedImage();
        return;
    }

    await handleChatInput(messageText, stagedImageForChat);
    if (userInput) userInput.value = '';
    clearStagedImage();
    if (userInput) userInput.focus();
    adjustTextareaHeight();
  }
}

function scrollToBottom(): void {
  if (chatLog) {
    chatLog.scrollTop = chatLog.scrollHeight;
  }
}

function populateActionChips(): void {
  if (!actionChipsContainer) return;
  actionChipsContainer.innerHTML = '';

  if (!apiKeyOk) {
      actionChipsContainer.innerHTML = '<p style="color: red; font-size: 0.8rem; padding-left: 10px;">Local services not available.</p>';
      return;
  }

  imageStyles.forEach(style => {
    const button = document.createElement('button');
    button.classList.add('style-button');
    button.textContent = style.name;
    button.setAttribute('data-style-id', style.id);
    button.setAttribute('aria-label', `Generate image with ${style.name} style`);
    button.addEventListener('click', () => handleStyleChipClick(style));
    actionChipsContainer.appendChild(button);
  });
}

function populateContextualActionChips(): void {
    if (!contextualActionChipsContainer) {
        console.warn("ContextualActionChipsContainer not found in DOM during populateContextualActionChips.");
        return;
    }
    contextualActionChipsContainer.innerHTML = ''; // Clear any existing chips

    if (!apiKeyOk) {
        console.log("Contextual chips not populated: Local services not available.");
        contextualActionChipsContainer.style.display = 'none'; // Ensure it's hidden
        return;
    }

    console.log(`Populating ${contextualActionPrompts.length} contextual action chips.`);
    contextualActionPrompts.forEach(action => {
        const button = document.createElement('button');
        button.classList.add('contextual-action-button');
        button.textContent = action.label;
        button.setAttribute('aria-label', action.ariaLabel);
        button.addEventListener('click', () => handleContextualActionChipClick(action.prompt));
        contextualActionChipsContainer.appendChild(button);
    });
}

async function handleContextualActionChipClick(prompt: string): Promise<void> {
    if (!apiKeyOk) {
        addBotMessage("⚠️ Local services not available.");
        return;
    }
    if (!stagedImageForChat) {
        addBotMessage("ℹ️ Please stage an image first to use this action.");
        return;
    }
    await handleChatInput(prompt, stagedImageForChat);
    if (userInput) userInput.value = ''; 
    clearStagedImage(); 
    if (userInput) userInput.focus();
    adjustTextareaHeight();
}


async function handleStyleChipClick(style: ImageStyle): Promise<void> {
  if (!apiKeyOk) {
    addBotMessage("⚠️ Local services not available.");
    return;
  }
  if (userInput && userInput.value.trim() !== '') {
    const basePrompt = userInput.value.trim();
    const fullPrompt = style.prefix + basePrompt;
    const imageRequestId = `img-req-${Date.now()}`;

    if (stagedImageForChat) {
        addBotMessage("ℹ️ Staged image for chat will be ignored for this style generation.", false);
    }

    addUserMessage(`Image Prompt (Style: ${style.displayName}): ${basePrompt}`, {isImageRequest: true, imageRequestId});
    await generateImageWithPrompt(basePrompt, fullPrompt, style.displayName, imageRequestId);
    userInput.value = '';
    if (userInput) userInput.focus();
    adjustTextareaHeight();
  } else {
    addBotMessage(`ℹ️ Please enter a description in the prompt area above, then click a style chip.`);
    if (userInput) userInput.focus();
  }
}

function showContextMenu(event: MouseEvent, selectedText: string): void {
  if (!customContextMenu || !contextMenuItemsList || !apiKeyOk) return;

  selectedTextForContextMenu = selectedText;
  contextMenuItemsList.innerHTML = '';

  imageStyles.forEach(style => {
    const li = document.createElement('li');
    li.textContent = style.name;
    li.setAttribute('role', 'menuitem');
    li.addEventListener('click', () => handleContextMenuItemClick(style));
    contextMenuItemsList.appendChild(li);
  });

  customContextMenu.style.left = `${event.pageX}px`;
  customContextMenu.style.top = `${event.pageY}px`;
  customContextMenu.style.display = 'block';
}

function hideContextMenu(): void {
  if (customContextMenu) {
    customContextMenu.style.display = 'none';
  }
  selectedTextForContextMenu = null;
}

async function handleContextMenuItemClick(style: ImageStyle): Promise<void> {
  if (!apiKeyOk) {
     addBotMessage("⚠️ Local services not available.");
     hideContextMenu();
     return;
  }
  if (selectedTextForContextMenu) {
    const basePrompt = selectedTextForContextMenu;
    const fullPrompt = style.prefix + basePrompt;
    const imageRequestId = `img-req-${Date.now()}`;
    if (stagedImageForChat) {
        addBotMessage("ℹ️ Staged image for chat will be ignored for this style generation from selection.", false);
    }
    addUserMessage(`Image Prompt (from selection - ${style.displayName}): ${basePrompt}`, {isImageRequest: true, imageRequestId});
    await generateImageWithPrompt(basePrompt, fullPrompt, style.displayName, imageRequestId);
  }
  hideContextMenu();
}

function handleTextSelection(event: MouseEvent): void {
    if (customContextMenu && customContextMenu.contains(event.target as Node)) {
        return;
    }
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    let parentMessage = null;
    if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let container = range.commonAncestorContainer;
        if (container.nodeType !== Node.ELEMENT_NODE) {
            container = container.parentNode!;
        }
        if (chatLog && chatLog.contains(container)) {
             parentMessage = (container as Element).closest('.message');
        }
    }
    if (selectedText && selectedText.length > 0 && parentMessage && chatLog?.contains(parentMessage)) {
        event.preventDefault();
        showContextMenu(event, selectedText);
    } else {
        hideContextMenu();
    }
}

function adjustTextareaHeight() {
  if (userInput) {
    userInput.style.height = 'auto';
    let newHeight = userInput.scrollHeight;
    const maxHeight = parseInt(window.getComputedStyle(userInput).maxHeight, 10) || 150;
    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      userInput.style.overflowY = 'auto';
    } else {
      userInput.style.overflowY = 'hidden';
    }
    userInput.style.height = `${newHeight}px`;
  }
}

function updateCurrentSidebarWidth() {
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    if (!mainContentWrapper || !imageGallerySidebar) return;

    const sidebarIsOpen = imageGallerySidebar.classList.contains('open');
    let newSidebarWidth = '0px';

    if (sidebarIsOpen) {
        newSidebarWidth = `${imageGallerySidebar.offsetWidth}px`;
    }
    mainContentWrapper.style.setProperty('--current-sidebar-width', newSidebarWidth);
}

let sidebarTransitionEndHandler: (() => void) | null = null;

function toggleGallerySidebar(): void {
    if (imageGallerySidebar && galleryToggleButton) {
        if (sidebarTransitionEndHandler && imageGallerySidebar) {
            imageGallerySidebar.removeEventListener('transitionend', sidebarTransitionEndHandler);
        }

        imageGallerySidebar.classList.toggle('open');
        const isOpen = imageGallerySidebar.classList.contains('open');
        galleryToggleButton.setAttribute('aria-expanded', isOpen.toString());

        requestAnimationFrame(() => {
            updateCurrentSidebarWidth();
        });

        sidebarTransitionEndHandler = () => {
            updateCurrentSidebarWidth();
            sidebarTransitionEndHandler = null; // Clear after use
        };
        imageGallerySidebar.addEventListener('transitionend', sidebarTransitionEndHandler, { once: true });
    }
}


async function downloadAllGalleryCards() {
    if (!apiKeyOk) {
        addBotMessage("⚠️ Local services not available.");
        return;
    }
    if (galleryItems.length === 0) {
        addBotMessage("ℹ️ Gallery is empty. Nothing to download.");
        return;
    }

    if (downloadAllGalleryButton) downloadAllGalleryButton.disabled = true;
    const thinkingMsg = addBotMessage("📦 Packaging all gallery cards for download, please wait...", true);

    const masterZip = new JSZip();

    for (const item of galleryItems) {
        const extracted = extractBase64Data(item.imageUrl);
        if (!extracted) {
            console.warn(`Skipping item ${item.id} due to image data extraction error.`);
            continue;
        }

        const extension = extracted.mimeType.split('/')[1] || 'jpeg';
        const localImageName = `image.${extension}`;

        const cardHtmlContent = getCardHTMLContent(item, localImageName);
        const safePromptSnippet = item.basePrompt.substring(0, 20).replace(/[^a-z0-9_]/gi, '_').replace(/__+/g, '_');
        const folderName = `card_${item.id}_${safePromptSnippet}`;

        const cardFolder = masterZip.folder(folderName);
        if (cardFolder) {
            cardFolder.file("card_info.html", cardHtmlContent);
            cardFolder.file(localImageName, extracted.base64, { base64: true });
        }
    }

    try {
        const content = await masterZip.generateAsync({ type: "blob" });
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `gallery_export_all_${timestamp}.zip`;

        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        addBotMessage("✅ All gallery cards packaged. Download starting.");
    } catch (e) {
        console.error("Error generating master zip file:", e);
        addBotMessage("⚠️ Sorry, there was an error creating the master gallery archive.");
    } finally {
        if (thinkingMsg && thinkingMsg.parentNode) {
            thinkingMsg.parentNode.removeChild(thinkingMsg);
        }
        if (downloadAllGalleryButton) downloadAllGalleryButton.disabled = galleryItems.length === 0;
    }
}

function showStagedImagePreview(dataUrl: string, mimeType: string) {
    stagedImageForChat = { dataUrl, mimeType };
    if (inputImagePreviewThumbnail) inputImagePreviewThumbnail.src = dataUrl;
    if (inputImagePreviewContainer) inputImagePreviewContainer.style.display = 'flex';

    if (contextualActionChipsContainer) {
        if (apiKeyOk) {
            contextualActionChipsContainer.style.display = 'flex';
            console.log("Contextual action chips are now VISIBLE.");
        } else {
            contextualActionChipsContainer.style.display = 'none';
            console.log("Contextual action chips remain HIDDEN: API key is not configured (apiKeyOk is false).");
        }
    } else {
         console.warn("ContextualActionChipsContainer not found in DOM when trying to show/hide it.");
    }
}

window.addEventListener('load', () => {
    // Assign DOM elements now that the DOM is fully loaded
    chatLog = document.getElementById('chat-log') as HTMLDivElement | null;
    userInput = document.getElementById('user-input') as HTMLTextAreaElement | null;
    actionChipsContainer = document.getElementById('action-chips-container') as HTMLDivElement | null;
    contextualActionChipsContainer = document.getElementById('contextual-action-chips-container') as HTMLDivElement | null;
    emptyChatPlaceholder = document.getElementById('empty-chat-placeholder') as HTMLDivElement | null;
    chatContainer = document.getElementById('chat-container') as HTMLDivElement | null;
    geminiInputBar = document.getElementById('gemini-input-bar') as HTMLDivElement | null;
    customContextMenu = document.getElementById('custom-context-menu') as HTMLDivElement | null;
    contextMenuItemsList = document.getElementById('context-menu-items') as HTMLUListElement | null;
    galleryItemsContainer = document.getElementById('gallery-items-container') as HTMLDivElement | null;
    imageGallerySidebar = document.getElementById('image-gallery-sidebar') as HTMLElement | null;
    galleryToggleButton = document.getElementById('gallery-toggle-button') as HTMLButtonElement | null;
    downloadAllGalleryButton = document.getElementById('download-all-gallery-button') as HTMLButtonElement | null;
    inputImagePreviewContainer = document.getElementById('input-image-preview-container') as HTMLDivElement | null;
    inputImagePreviewThumbnail = document.getElementById('input-image-preview-thumbnail') as HTMLImageElement | null;
    inputImagePreviewRemoveButton = document.getElementById('input-image-preview-remove') as HTMLButtonElement | null;

    // API Key related UI updates
    if (!apiKeyOk) {
        if (actionChipsContainer) actionChipsContainer.innerHTML = '<p style="color: red; font-size: 0.8rem; padding-left: 10px;">Local services not available.</p>';
        if (contextualActionChipsContainer) contextualActionChipsContainer.style.display = 'none';
        if (galleryItemsContainer) galleryItemsContainer.innerHTML = '<p style="color: red; font-size: 0.8rem; padding: 10px;">Local services not available.</p>';
        if (downloadAllGalleryButton) downloadAllGalleryButton.disabled = true;
    }

    // Initial setup calls
    if (userInput) userInput.focus();
    populateActionChips();
    populateContextualActionChips(); 
    checkChatEmpty();
    adjustTextareaHeight();
    updateCurrentSidebarWidth(); 

    if (!apiKeyOk && galleryItemsContainer) {
        // This condition is already handled above, but kept for clarity if there were other specific gallery UI items.
    } else if (galleryItemsContainer) {
        addOrUpdateGallery(); // Render empty state if galleryItems is empty
    }
    if (inputImagePreviewContainer) inputImagePreviewContainer.style.display = 'none';
    if (contextualActionChipsContainer) {
         contextualActionChipsContainer.style.display = 'none'; // Ensure initially hidden
         console.log("Contextual chips initially hidden on page load (after DOM ready).");
    }

    // Attach event listeners that depend on DOM elements
    if (geminiInputBar && inputImagePreviewContainer && inputImagePreviewThumbnail && inputImagePreviewRemoveButton) {
        geminiInputBar.addEventListener('dragover', (event) => {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
            geminiInputBar.classList.add('drop-target-active');
        });

        geminiInputBar.addEventListener('dragleave', () => {
            geminiInputBar.classList.remove('drop-target-active');
        });

        geminiInputBar.addEventListener('drop', (event) => {
            event.preventDefault();
            geminiInputBar.classList.remove('drop-target-active');
            if (!apiKeyOk) {
                addBotMessage("⚠️ Local services not available.");
                return;
            }

            if (event.dataTransfer && event.dataTransfer.files.length > 0) {
                const file = event.dataTransfer.files[0];
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        if (e.target && typeof e.target.result === 'string') {
                            console.log("Image file read, attempting to extract data...");
                            const imageDetails = extractBase64Data(e.target.result);
                            if (imageDetails) {
                               console.log("Image data extracted, calling showStagedImagePreview.");
                               showStagedImagePreview(e.target.result, imageDetails.mimeType);
                            } else {
                                addBotMessage("⚠️ Could not process dropped image file (extraction failed).");
                                console.warn("extractBase64Data failed for dropped file.");
                            }
                        }
                    };
                    reader.readAsDataURL(file);
                } else {
                    addBotMessage("⚠️ Please drop an image file.");
                }
            } else if (event.dataTransfer) {
                try {
                    const jsonData = event.dataTransfer.getData('application/json');
                    if (jsonData) {
                        const data = JSON.parse(jsonData);
                        if (data.imageUrl) {
                            console.log("Image from gallery dropped, attempting to extract data...");
                            const imageDetails = extractBase64Data(data.imageUrl);
                            if (imageDetails) {
                               console.log("Image data extracted from gallery drop, calling showStagedImagePreview.");
                               showStagedImagePreview(data.imageUrl, imageDetails.mimeType);
                            } else {
                                 addBotMessage("⚠️ Could not process image data from gallery (extraction failed).");
                                 console.warn("extractBase64Data failed for gallery image drop.");
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error processing dropped data from gallery:", e);
                    addBotMessage("⚠️ Could not read dropped image data from gallery.");
                }
            }
        });

        if (inputImagePreviewRemoveButton) {
            inputImagePreviewRemoveButton.addEventListener('click', clearStagedImage);
        }
    }

    if (galleryToggleButton) {
        galleryToggleButton.addEventListener('click', toggleGallerySidebar);
    }
    if (downloadAllGalleryButton) {
        downloadAllGalleryButton.addEventListener('click', downloadAllGalleryCards);
    }

    if (userInput) {
      userInput.addEventListener('keydown', function(event: KeyboardEvent) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          submitMessage();
        }
      });
      userInput.addEventListener('input', adjustTextareaHeight);
    }

    if (chatLog) {
        chatLog.addEventListener('contextmenu', handleTextSelection);
        chatLog.addEventListener('mouseup', handleTextSelection);
    }
    document.addEventListener('click', (event) => {
        if (customContextMenu && customContextMenu.style.display === 'block') {
            if (!customContextMenu.contains(event.target as Node)) {
                const selection = window.getSelection();
                const clickedOnChatLog = chatLog && chatLog.contains(event.target as Node);
                const makingNewSelection = clickedOnChatLog && selection && selection.toString().trim().length > 0;
                if (!makingNewSelection) {
                     hideContextMenu();
                }
            }
        }
    });
});

window.addEventListener('resize', updateCurrentSidebarWidth);
