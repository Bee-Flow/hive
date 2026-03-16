import { useState, useRef } from 'react';

/**
 * All form/UI state for the AgentDesigner.
 * Returns a flat object of [value, setter] pairs grouped by concern.
 */
export default function useAgentState() {
    // Core
    const [agents, setAgents] = useState([]);
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [components, setComponents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [systemPrompt, setSystemPrompt] = useState('');
    const [selectedTools, setSelectedTools] = useState([]);
    const [toolParams, setToolParams] = useState({});
    const [model, setModel] = useState('');
    const [isPublished, setIsPublished] = useState(false);
    const [sharedGroups, setSharedGroups] = useState([]);
    const [showPublishMenu, setShowPublishMenu] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [orgGroups, setOrgGroups] = useState([]);
    const [availableModels, setAvailableModels] = useState([]);
    const [modelTiers, setModelTiers] = useState({});
    const [starterPrompts, setStarterPrompts] = useState([]);
    const [avatar, setAvatar] = useState('\u{1F916}');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [emojiCategory, setEmojiCategory] = useState('smileys');

    // Behavior
    const [allowCopy, setAllowCopy] = useState(true);
    const [embedEnabled, setEmbedEnabled] = useState(false);
    const [workspaceEnabled, setWorkspaceEnabled] = useState(false);
    const [enableGuardrails, setEnableGuardrails] = useState(false);
    const [llamaGuardEnabled, setLlamaGuardEnabled] = useState(false);
    const [webSearchGuardEnabled, setWebSearchGuardEnabled] = useState(false);

    const [strictKnowledge, setStrictKnowledge] = useState(false);
    const [includeSourceReferences, setIncludeSourceReferences] = useState(false);
    const [knowledgeBaseIds, setKnowledgeBaseIds] = useState([]);

    // Regex Guardrails
    const [regexGuardrailsEnabled, setRegexGuardrailsEnabled] = useState(false);
    const [selectedCollections, setSelectedCollections] = useState([]);
    const [availableCollections, setAvailableCollections] = useState([]);
    const [regexScope, setRegexScope] = useState({
        userInput: true,
        agentOutput: true,
        toolInput: false,
        toolOutput: false
    });
    const [guardrailAction, setGuardrailAction] = useState('delete');

    // Bubble widget styling
    const [bubbleColor, setBubbleColor] = useState('#f5a623');
    const [bubblePosition, setBubblePosition] = useState('right');
    const [bubbleSize, setBubbleSize] = useState(60);
    const [bubbleIcon, setBubbleIcon] = useState('🐝');
    const [windowWidth, setWindowWidth] = useState(400);
    const [windowHeight, setWindowHeight] = useState(600);
    const [chatFont, setChatFont] = useState('System Default');
    const [chatFontSize, setChatFontSize] = useState(14);
    const [chatLineHeight, setChatLineHeight] = useState(1.5);
    const [userBubbleColor, setUserBubbleColor] = useState('');
    const [assistantBubbleColor, setAssistantBubbleColor] = useState('');
    const [warningText, setWarningText] = useState('');

    // Navigation
    const [activeSection, setActiveSection] = useState('identity');
    const [activeGuardrailTab, setActiveGuardrailTab] = useState('llama');
    const [showPreview, setShowPreview] = useState(false);

    // Chat
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showToolSelector, setShowToolSelector] = useState(false);
    const [integrationStatus, setIntegrationStatus] = useState(null);
    const [enabledIntegrations, setEnabledIntegrations] = useState(null);

    // Prompt Designer
    const [showPromptDesigner, setShowPromptDesigner] = useState(false);
    const [promptDesignerMessages, setPromptDesignerMessages] = useState([]);
    const [promptDesignerInput, setPromptDesignerInput] = useState('');
    const [promptDesignerLoading, setPromptDesignerLoading] = useState(false);

    // Refs
    const chatEndRef = useRef(null);
    const emojiPickerRef = useRef(null);

    return {
        // Core
        agents, setAgents, selectedAgent, setSelectedAgent,
        isCreating, setIsCreating, components, setComponents,
        loading, setLoading, saving, setSaving,
        // Form
        name, setName, description, setDescription,
        systemPrompt, setSystemPrompt, selectedTools, setSelectedTools,
        toolParams, setToolParams, model, setModel,
        isPublished, setIsPublished, sharedGroups, setSharedGroups,
        showPublishMenu, setShowPublishMenu, organizations, setOrganizations,
        orgGroups, setOrgGroups, availableModels, setAvailableModels,
        modelTiers, setModelTiers, starterPrompts, setStarterPrompts,
        avatar, setAvatar, showEmojiPicker, setShowEmojiPicker,
        emojiCategory, setEmojiCategory,
        // Behavior
        allowCopy, setAllowCopy, embedEnabled, setEmbedEnabled,
        workspaceEnabled, setWorkspaceEnabled, enableGuardrails, setEnableGuardrails,
        llamaGuardEnabled, setLlamaGuardEnabled, webSearchGuardEnabled, setWebSearchGuardEnabled,

        strictKnowledge, setStrictKnowledge,
        includeSourceReferences, setIncludeSourceReferences,
        knowledgeBaseIds, setKnowledgeBaseIds,
        // Regex Guardrails
        regexGuardrailsEnabled, setRegexGuardrailsEnabled,
        selectedCollections, setSelectedCollections,
        availableCollections, setAvailableCollections,
        regexScope, setRegexScope, guardrailAction, setGuardrailAction,
        // Bubble Widget
        bubbleColor, setBubbleColor, bubblePosition, setBubblePosition,
        bubbleSize, setBubbleSize, bubbleIcon, setBubbleIcon,
        windowWidth, setWindowWidth, windowHeight, setWindowHeight,
        chatFont, setChatFont, chatFontSize, setChatFontSize,
        chatLineHeight, setChatLineHeight,
        userBubbleColor, setUserBubbleColor,
        assistantBubbleColor, setAssistantBubbleColor,
        warningText, setWarningText,
        // Navigation
        activeSection, setActiveSection, activeGuardrailTab, setActiveGuardrailTab,
        showPreview, setShowPreview,
        // Chat
        messages, setMessages, chatInput, setChatInput,
        chatLoading, setChatLoading, showChat, setShowChat,
        showToolSelector, setShowToolSelector,
        integrationStatus, setIntegrationStatus,
        enabledIntegrations, setEnabledIntegrations,
        // Prompt Designer
        showPromptDesigner, setShowPromptDesigner,
        promptDesignerMessages, setPromptDesignerMessages,
        promptDesignerInput, setPromptDesignerInput,
        promptDesignerLoading, setPromptDesignerLoading,
        // Refs
        chatEndRef, emojiPickerRef,
    };
}
