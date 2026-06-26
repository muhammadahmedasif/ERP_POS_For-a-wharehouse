import React, { useState, useEffect, useRef } from "react";

import { useAppStore } from "../store";
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Bot, 
  User, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle,
  ArrowRight,
  PackageCheck,
  Bookmark,
  Sparkles,
  Info
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
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "ai",
      text: "خوش آمدید! میں ہول سیل ERP کا وائس اسسٹنٹ ہوں۔ آپ مجھ سے اردو یا انگریزی میں بات کر سکتے ہیں، مثلاً: 'سب سے زیادہ بکنے والی پروڈکٹ کونسی ہے؟' یا 'مجھے 50 کیچپ شامل کرنے ہیں'۔",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Voice/SST state
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [recognitionError, setRecognitionError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load resources
  useEffect(() => {
    fetchProducts();

    // Initialize Web Speech Recognition
    const SpeechRecognitionModule = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionModule) {
      const recognition = new SpeechRecognitionModule();
      recognition.continuous = true; // Use continuous to prevent browser from auto-stopping too early on brief pauses
      recognition.interimResults = true;
      recognition.lang = "ur-PK"; // Default to Urdu (Pakistan)

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

        // Reset silence timeout on speech activity
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = setTimeout(() => {
          recognition.stop();
        }, 3500);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setRecognitionError(
            "مائیکرو فون تک رسائی کی اجازت نہیں ہے۔"
          );
        } else if (event.error !== "no-speech") {
          setRecognitionError(`مائیکرو فون کی خرابی: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      };

      recognitionRef.current = recognition;
    } else {
      setRecognitionError("آپ کا براؤزر مائیکروفون اسپیچ ریکگنیشن کی اجازت نہیں دیتا۔ برائے مہربانی دستی ٹائپ کیجئے۔");
    }

    return () => {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      window.speechSynthesis.cancel();
    };
  }, [fetchProducts]);

  // Trigger microphone push to talk
  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported or not initialized in your browser.');
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
        console.error("Failed to start voice model:", err);
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
      
      // Update inventory on successful state changes
      if (data.executed) {
        await fetchProducts(); // fetch updated products database
        if (data.action === 'pay_customer' || data.action === 'add_debt' || data.action === 'make_sale') {
          await fetchCustomers?.();
        }
      }

      const aiMsgId = (Date.now() + 1).toString();
      const responseUrduText = data.message_ur || "معذرت، میں آپ کی بات سمجھ نہیں پایا۔";

      setMessages((prev) => [
        ...prev,
        {
          id: aiMsgId,
          role: "ai",
          text: responseUrduText,
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
      const errMsg = "سرور سے رابطہ کرنے میں خامی پیش آئی ہے۔";
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "ai",
          text: errMsg,
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

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] w-full max-w-6xl mx-auto">
      
      {/* LEFT COL: VOICE INTERACTION MODULE */}
      <div className="flex-1 flex flex-col h-full bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        
        {/* HEADER */}
        <div className="flex items-center justify-between bg-slate-50 border-b border-slate-200 p-4 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-800 leading-none">
                AI ERP Assistant
              </h1>
              <p className="text-[11px] text-slate-500 mt-0.5">Voice & Text Operations</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto Mic removed per request */}
          </div>
        </div>

        {/* ERROR NOTIFICATION */}
        {recognitionError && (
          <div className="bg-red-50 text-red-700 p-3 text-xs font-semibold border-b border-red-100 flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div className="whitespace-pre-line">{recognitionError}</div>
          </div>
        )}

        {/* CORE CHAT FEEDBACK PANEL */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white grow">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} gap-3`}>
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === "user" ? "bg-slate-200 text-slate-600" : "bg-indigo-100 text-indigo-600"
                  }`}
                >
                  {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="space-y-1">
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-slate-100 text-slate-800"
                        : "bg-white border border-slate-200 text-slate-800"
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {/* METADATA DATABASE ACTION BADGE */}
                  {msg.actionDetails && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1 ml-1">
                      {msg.actionDetails.action !== "error" && msg.actionDetails.executed ? (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-[10px] font-medium text-emerald-700 border border-emerald-100">
                          <CheckCircle className="w-3 h-3" />
                          <span className="uppercase font-bold tracking-wider">{msg.actionDetails.action.replace("_", " ")}</span>
                          <span className="opacity-40">|</span>
                          {msg.actionDetails.action === 'pay_customer' ? (
                            <span className="font-bold">Rs. {msg.actionDetails.quantity} (Customer)</span>
                          ) : (
                            <span className="font-bold">{msg.actionDetails.product || msg.actionDetails.sku || "N/A"}</span>
                          )}
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-[10px] font-medium text-amber-700 border border-amber-100">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="font-bold uppercase tracking-wider">No DB Action</span>
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
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="rounded-xl px-4 py-3 bg-slate-50 border border-slate-100 flex items-center gap-1.5 h-10">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* TRANSCRIPT DISPLAY GRID & PUSH TO TALK SYSTEM */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0">
          
          {/* Live voice tracking */}
          {isListening && liveTranscript && (
            <div className="mb-3 px-3 py-2 bg-indigo-50 rounded-md border border-indigo-100 text-xs text-indigo-800 font-medium break-words">
              {liveTranscript}
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Voice PUSH TO TALK key container */}
            <button
              type="button"
              onClick={toggleListening}
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? "bg-rose-500 text-white animate-pulse"
                  : "bg-slate-200 text-slate-600 hover:bg-slate-300"
              }`}
            >
              {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <form onSubmit={handleSendSubmit} className="flex-1 flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your command..."
                disabled={isLoading}
                className="flex-1 bg-white border-slate-300 focus:border-indigo-500 rounded-md h-11"
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-md h-11 px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* RIGHT COL: INVENTORY SNAPSHOT DICTIONARY */}
      <div className="w-full lg:w-72 xl:w-80 shrink-0 h-48 lg:h-full flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
            Available Target SKUs
          </h3>
          <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-600 font-mono font-bold">
            {products.length} Products
          </span>
        </div>
        <div className="p-3 text-[11px] text-slate-500 border-b border-slate-100 bg-white leading-relaxed shrink-0 select-none">
          Use the exact SKUs/Names listed below when issuing commands to ensure accurate matching.
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {products.map((product) => (
            <div 
              key={product.id} 
              className="p-3 bg-slate-50/50 rounded-lg border border-slate-100 hover:border-indigo-100 transition-colors"
            >
              <div className="flex justify-between items-start gap-1">
                <h4 className="text-xs font-bold text-slate-800 font-serif leading-tight">
                  {product.name}
                </h4>
                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-mono font-bold leading-none ${
                  product.stock > 100 
                    ? "bg-emerald-50 text-emerald-700" 
                    : product.stock > 40 
                    ? "bg-amber-50 text-amber-700" 
                    : "bg-rose-50 text-rose-700"
                }`}>
                  {product.stock} units
                </span>
              </div>

              <div className="flex justify-between items-center mt-2 pt-1.5 border-t border-slate-100/50 text-[10px] text-slate-400 font-mono">
                <span className="text-[9px] font-bold text-slate-500 flex items-center gap-1">
                  <Bookmark className="w-2.5 h-2.5 text-purple-600" />
                  {product.brand || "Unbranded"}
                </span>
                <span className="font-bold text-slate-600">Rs. {product.price.toFixed(2)}</span>
              </div>
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-xs">
              کوئی پروڈکٹ لوڈ نہیں ہوئی
            </div>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 bg-amber-50/20 p-2.5 rounded-lg border border-amber-100/30">
          <div className="flex gap-2 items-start text-[10px] text-amber-800 font-medium">
            <Info className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              اگر سسٹم پروڈکٹ ریکارڈر کا نام درست نہ ڈھونڈ پائے، تو ایل ایل ایم آٹو کارروائی کو مسترد کر کے مطلع کرے گا۔ یہ انوینٹری کے لیے انتہائی محفوظ ہے۔
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AIAssistant;
