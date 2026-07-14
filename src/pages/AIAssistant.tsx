import React, { useState, useEffect, useRef } from "react";

import { useAppStore } from "../store";
import { toast } from 'sonner';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { 
  Mic, 
  MicOff, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  PackageCheck,
  Bookmark,
  Sparkles,
  Info,
  X,
  Maximize2,
  Minimize2,
  MessageCircle
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "ai";
  text: string;
  transcript?: string;
  actionDetails?: {
    action: string;
    product: string | null;
    sku?: string;
    quantity: number;
    executed: boolean;
    currentStock?: number;
  };
  isLoading?: boolean;
}

const AIAssistant = () => {
  
  const { products, fetchProducts, fetchCustomers } = useAppStore();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: "Hi! I'm the ERP Voice Assistant. You can ask me things like: 'What are my top selling products?' or 'Add 50 ketchup bottles to inventory'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProducts();

    const SpeechRecognitionModule = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionModule) {
      const recognition = new SpeechRecognitionModule();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
        setRecognitionError(null);
        setLiveTranscript("");
      };

      recognition.onresult = (event: any) => {
        const currentActiveText = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join("");
        
        setLiveTranscript(currentActiveText);
        setInput(currentActiveText);

        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          recognition.stop();
        }, 3500);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setRecognitionError("Microphone access not allowed.");
        } else if (event.error !== "no-speech") {
          setRecognitionError(`Microphone error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      };

      recognitionRef.current = recognition;
    } else {
      setRecognitionError("Your browser does not support speech recognition.");
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      window.speechSynthesis.cancel();
    };
  }, [fetchProducts]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        setLiveTranscript("");
        setInput("");
        recognitionRef.current.start();
      } catch (err) {
        console.error("Failed to start voice:", err);
      }
    }
  };

  const executeVoiceCommand = async (command: string) => {
    if (!command.trim()) return;

    const userMsgId = Date.now().toString();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", text: command }
    ]);
    
    setInput("");
    setLiveTranscript("");
    setIsLoading(true);

    try {
      const { user, settings } = useAppStore.getState();
      const sellerName = user?.name || settings?.sellerName || "Admin";

      const res = await fetch("/api/ai/voice-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: command, sellerName }),
      });

      const data = await res.json();
      
      if (data.executed) {
        await fetchProducts();
        if (data.action === 'pay_customer' || data.action === 'add_debt' || data.action === 'make_sale') {
          await fetchCustomers?.();
        }
      }

      const aiMsgId = (Date.now() + 1).toString();
      const responseText = data.message_en || data.message_ur || "Sorry, I couldn't understand that.";

      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "ai",
          text: responseText,
          actionDetails: {
            action: data.action,
            product: data.product,
            sku: data.sku,
            quantity: data.quantity,
            executed: !!data.executed,
            currentStock: data.currentStock
          }
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          text: "Could not connect to the server. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    executeVoiceCommand(input.trim());
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setIsExpanded(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={toggleOpen}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-800 transition-all flex items-center justify-center z-50"
        title="Open AI Assistant"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex flex-col bg-white rounded-xl shadow-xl border border-border overflow-hidden transition-all duration-200 ${
      isExpanded ? "w-[640px] h-[640px]" : "w-[400px] h-[520px]"
    }`}>
      
      {/* HEADER */}
      <div className="flex items-center justify-between bg-neutral-900 text-white px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">AI Assistant</p>
            <p className="text-[10px] text-white/60 mt-0.5">Voice & Text Commands</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={toggleOpen} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ERROR */}
      {recognitionError && (
        <div className="bg-rose-50 text-rose-700 p-2.5 text-xs border-b border-rose-100 flex items-start gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{recognitionError}</span>
        </div>
      )}

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`flex max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} gap-2`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-neutral-100 text-neutral-500" : "bg-primary-100 text-primary-600"
              }`}>
                {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className="space-y-1">
                <div className={`rounded-2xl px-3.5 py-2 text-sm ${
                  msg.role === "user" ? "bg-primary-50 text-neutral-900" : "bg-neutral-50 border border-border text-neutral-900"
                }`}>
                  <p className="leading-relaxed whitespace-pre-wrap text-sm">{msg.text}</p>
                </div>

                {msg.actionDetails && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1 ml-1">
                    {msg.actionDetails.action !== "error" && msg.actionDetails.executed ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                        <CheckCircle className="w-3 h-3" />
                        <span className="uppercase font-medium tracking-wider">{msg.actionDetails.action.replace("_", " ")}</span>
                        <span className="opacity-40">|</span>
                        {msg.actionDetails.action === 'pay_customer' ? (
                          <span className="font-medium">Rs. {msg.actionDetails.quantity} (Customer)</span>
                        ) : (
                          <span className="font-medium">{msg.actionDetails.product || msg.actionDetails.sku || "N/A"}</span>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-[10px] font-medium text-amber-700 border border-amber-100">
                        <AlertTriangle className="w-3 h-3" />
                        <span className="font-medium uppercase tracking-wider">No DB Action</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex flex-row max-w-[80%] gap-3">
              <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="rounded-xl px-4 py-3 bg-neutral-50 border border-border flex items-center gap-1.5 h-9">
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT */}
      <div className="p-3 bg-neutral-50 border-t border-border shrink-0">
        {isListening && liveTranscript && (
          <div className="mb-2 px-3 py-2 bg-primary-50 rounded-lg border border-primary-100 text-xs text-primary-800 font-medium break-words">
            {liveTranscript}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleListening}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
              isListening ? "bg-rose-500 text-white animate-pulse" : "bg-neutral-200 text-neutral-500 hover:bg-neutral-300"
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <form onSubmit={handleSendSubmit} className="flex-1 flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a command..."
              disabled={isLoading}
              className="flex-1 bg-white h-10"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
