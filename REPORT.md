# Project Report: KhataMitra (खातामित्र) AI Ledger Assistant

## 1. Project Overview

### Project Title
**KhataMitra (खातामित्र)**

### Project Description
**KhataMitra** is a modern, mobile-first, bilingual (Hindi/English) full-stack AI-powered ledger assistant designed for small business shopkeepers (retailers) and their customers in India. Built with **Next.js 16 (App Router)** and styled using CSS/Tailwind, the application integrates **Supabase** for database management and secure authentication, and leverages **Google Gemini 2.5** to enable voice/text conversational ledger entry, reminders scheduling, and automated transaction management.

### Purpose and Objectives
* **Simplify Ledger Management (Udhaar/Jama)**: Replace paper-based ledger books (Bahi Khata) with a digital, voice-enabled assistant.
* **Remove Language Barriers**: Provide native English, Hindi, and colloquial Hinglish conversational interfaces for both voice and text.
* **Automate Workflows**: Use AI function-calling agents to parse unstructured conversational entries (e.g. "Ramu ko ₹200 ki cheeni udhaar di") and map them directly to database mutations.
* **Integrate Shop Operations**: Provide a built-in Stationery and Bookstore Inventory Management module to track stocks and counter sales automatically.
* **Facilitate Customer Trust**: Provide a dedicated Customer portal for buyers to review their transactional statement history and current balance.

### Problem Statement
Paper-based record-keeping is prone to errors, damage, and loss. Local shopkeepers find traditional digital ledger applications too complex to type, especially on small screens. Many are comfortable speaking their entries in Hindi or Hinglish. There is a clear need for an autonomous AI-driven assistant that listens, understands local languages and currency units, performs the transactions directly, and reads back the response with a clear voice.

### Scope of the Project
* **Retailer Dashboard**: Multi-ledger tracking, customer registration, transaction logging, collection reminders, and a stationery shop inventory tracker.
* **Customer Dashboard**: Personalized access to balance status, detailed credit/debit history statements, and account profile settings.
* **Conversational AI Engine**: Multi-turn text/voice interface powered by Gemini 2.5 Flash, equipped with database access tools (`find_customer`, `create_customer_and_link`, `add_transaction`, `get_balance`, `get_ledger_history`, etc.).
* **Voice Capabilities**: Web Audio API (MediaRecorder) for speech capture, and Speech Synthesis (TTS) with a chunked, markdown-cleaned, Indian-accented async speech output engine.
* **Supabase Services**: PostgreSQL relational database with Row-Level Security (RLS) policies and trigger functions.

---

## 2. System Architecture

### High-Level Architecture Diagram
```
              +-----------------------------------------+
              |               Web Browser               |
              |       (Chat UI / Voice / Dashboard)     |
              +--------------------+--------------------+
                                   |
                                   | HTTP POST / Audio
                                   v
             +---------------------+---------------------+
             |         Next.js App Router API            |
             |  (/api/assistant & /api/voice-assistant)  |
             +--------+------------------------+---------+
                      |                        |
                      | Tool Calls / Retry     | Supabase SSR
                      v                        v
             +--------+---------+    +---------+---------+
             |    Google GenAI  |    |  Supabase Client  |
             |   (Gemini API)   |    |    (Auth & DB)    |
             +------------------+    +---------+---------+
                                               |
                                               v
                                     +---------+---------+
                                     |  PostgreSQL Database |
                                     |  (RLS, Triggers)  |
                                     +-------------------+
```

### Architecture Explanation
* **Frontend (Next.js & React)**: Served as a modern, responsive single-page visual dashboard with dashboard components for retailers and customers. Communication with backend APIs is secured with Session Tokens and Supabase SSR contexts.
* **Bilingual Assistant APIs**: `/api/assistant` handles conversational text input, while `/api/voice-assistant` processes base64 audio payloads. Both routes instantiate a multi-turn agent execution loop with the Google GenAI client.
* **Autonomous AI Loop**: The agent reads the user's conversational request, checks context parameters, executes database tools if needed, resolves relationships, and returns answers to the browser.
* **Database (PostgreSQL)**: Houses relational data. Triggers calculate balance changes and decrement inventory stocks when sales occur. RLS policies restrict operations so users can only view their own files/transactions.

---

## 3. Technology Stack

### Frontend & UI
* **Next.js (v16.2.4)**: Core application framework with App Router, API routes, and Server Actions.
* **React (v19.2.4)**: Single-page interactivity, state hooks, and client views.
* **Lucide React**: Premium icon assets.
* **CSS & Tailwind**: Responsive grid frameworks, customized crimson-gold themes, and floating cards.

### Backend & Database
* **Supabase SSR**: Secure cookie-based session hydration and authentication middleware.
* **Supabase Auth**: Password-based login, password reset, and registration.
* **Supabase PostgreSQL**: Managed relation store.
* **PL/pgSQL Triggers**: Handles automatic balance logic and stock decrement workflows.

### Artificial Intelligence
* **Google GenAI SDK (`@google/genai`)**: Interacts with the `gemini-2.5-flash` model.
* **Gemini Tool Calling**: Converts conversation parameters to structured function calls.
* **Custom Retry Engine**: Retries with exponential backoff on 429 Rate Limits / Resource Exhausted errors.

---

## 4. Database Design

### Schema Design & RLS Policies
The database consists of 7 core tables under the `public` schema:

#### 1. `profiles`
Tracks user accounts linked to Supabase Auth.
* `id` (UUID, PK referencing `auth.users` on delete cascade)
* `full_name` (Text, Not Null)
* `phone` (Text, Unique)
* `role` (Text, Check: `'retailer' | 'customer'`, Not Null)
* `business_name` (Text)
* `preferred_language` (Text, Default `'hi'`, Check: `'hi' | 'en'`)
* `created_at` (Timestamptz)

#### 2. `relationships`
Defines links between retailers and their customers.
* `id` (UUID, PK default `gen_random_uuid()`)
* `retailer_id` (UUID, FK to `profiles`)
* `customer_id` (UUID, FK to `profiles`)
* `balance` (Numeric, default `0`, positive = customer owes retailer)
* `created_at` (Timestamptz)

#### 3. `transactions`
Tracks individual credits (money lent) and debits (money received).
* `id` (UUID, PK)
* `relationship_id` (UUID, FK to `relationships`)
* `type` (Text, Check: `'credit' | 'debit'`)
* `amount` (Numeric, Not Null)
* `note` (Text)
* `created_by` (UUID, FK to `profiles`)
* `transaction_date` (Date, default `current_date`)
* `created_at` (Timestamptz)

#### 5. `reminders`
Schedules notifications for pending collections.
* `id` (UUID, PK)
* `user_id` (UUID, FK to `profiles`)
* `relationship_id` (UUID, FK to `relationships`)
* `remind_at` (Timestamptz, Not Null)
* `type` (Text, Check: `'call' | 'payment'`)
* `message` (Text, Not Null)
* `status` (Text, Check: `'pending' | 'sent' | 'done'`)
* `channel` (Text, Check: `'app' | 'whatsapp' | 'sms' | 'email'`)

#### 6. `chat_logs`
Logs conversational exchanges for AI quality control.
* `id` (UUID, PK)
* `user_id` (UUID, FK to `profiles`)
* `role` (Text, Check: `'user' | 'assistant'`)
* `message` (Text)
* `language` (Text)
* `created_at` (Timestamptz)

#### 7. `inventory`
Manages store stationery items.
* `id` (BigInt, Identity PK)
* `retailer_id` (UUID, FK to `profiles`)
* `item_name` (Text, Not Null)
* `category` (Text, Check: `'books' | 'pens' | 'notebooks' | 'art_supplies' | 'other'`)
* `stock_quantity` (Integer, Check >= 0)
* `cost_price` (Numeric)
* `selling_price` (Numeric)
* `low_stock_threshold` (Integer)

#### 8. `stationery_sales`
Tracks bookstore counter sales.
* `id` (UUID, PK)
* `retailer_id` (UUID, FK to `profiles`)
* `item_id` (BigInt, FK to `inventory`)
* `quantity_sold` (Integer)
* `total_amount` (Numeric)
* `created_at` (Timestamptz)

### Database Triggers
* **`trg_update_balance`**: Automatically runs after inserting a row in `transactions`. Computes the new relationship balance (adds for `credit`, subtracts for `debit`).
* **`trg_decrement_stock`**: Automatically runs after inserting a row in `stationery_sales`. Deducts the sold items from `inventory.stock_quantity`.

---

## 5. Project Structure

```
/src
  /app                     # Next.js App Router
    /actions               # Server Actions (Auth, Stationery sales)
    /api                   # Serverless routes
      /assistant           # Text AI endpoint
      /voice-assistant     # Voice AI endpoint
      /delete-account      # User deletion utility
    /auth                  # Authentication flows & callbacks
    /customer              # Customer Dashboard view page
    /login                 # Credential sign-in page
    /reset-password        # Forgotten password reset page
    /retailer              # Retailer Dashboard view page
    /setup-profile         # Profile onboarding redirect page
    /signup                # User registration page
    layout.tsx             # Root layout
    page.tsx               # Primary landing / login gateway
    globals.css            # Stylesheets & font variables
  /components              # Component library
    ChatAssistant.tsx      # Floating chat interface with TTS synthesis
    ChatInput.tsx          # Dual mode text/mic recorder
    CustomerDashboard.tsx  # Customer portal panel
    DeleteAccountModal.tsx # Account self-deletion utility
    LanguageToggle.tsx     # English/Hindi toggler
    LedgerHistory.tsx      # Core transactional lists
    RetailerDashboard.tsx  # Multi-ledger shop manager
    StationeryManager.tsx  # Bookstore inventory controller
  /hooks                   # React state wrappers
  /lib                     # Utility scripts
    gemini.ts              # Gemini API client, retries, and tool templates
    translations.ts        # Localization maps (Hindi / English UI text)
```

---

## 6. Feature Implementation

### The Autonomous Conversational Loop
Conversational tool-execution follows a multi-turn design that chains up to 5 calls:
1. **Find Customer**: Checks if the customer exists in database relationships using `find_customer`.
2. **Handle Non-Existent Users**: If `find_customer` reports `not_found: true`, the assistant invokes `create_customer_and_link` to create a placeholder profile and link it.
3. **Execute Transaction**: Invokes `add_transaction` using the resolved customer UUID.
4. **Log Conversational Logs**: Stores both the user input and the model's text response inside `chat_logs`.

### Text-To-Speech Clean Async Engine
To read back responses cleanly:
* **Cleaning Filter**: Removes markdown bolding (`**`), italics (`*`), code boxes, dashes, bullets, and parses the currency symbol `₹` as the spoken word `"rupaye"`.
* **Voice Promise Cache**: Listens to browser `voiceschanged` events to reliably load the system voice list.
* **Splitting Mechanism**: Divides the final answer text into sentences under 180 characters to bypass typical browser text-to-speech length limits.
* **Natural Playback**: Plays chunks sequentially via chaining, configuring slow speech, standard pitch, and full volume.

---

## 7. API Documentation

### Conversational Assistant API (`POST /api/assistant`)
Expects text input or audio data.

* **Payload Structure**:
  ```json
  {
    "userId": "UUID",
    "inputType": "text",
    "textPayload": "Ramu ko ₹200 ki cheeni udhaar di",
    "history": []
  }
  ```
* **Success Response**:
  ```json
  {
    "response": "Maine suna: Ramu ko ₹200 ki cheeni udhaar di. Ramu ka account mil gaya aur ₹200 credit/udhaar jod diya gaya hai! ✅",
    "toolExecuted": true
  }
  ```

---

## 8. Security Implementation
* **Row-Level Security (RLS)**: Enforced across all tables. Users can only select/update rows containing their own `id`, `retailer_id`, or `customer_id`.
* **Service-Role Boundary**: Sensitive profile mutations (such as creating customer links during conversation flows) run using a secure Admin client restricted strictly to backend route executors.
* **Environment Variables**: Sensitive tokens and keys are never exposed on client browsers.

---

## 9. Dependencies
* `@google/genai`: SDK for Gemini models.
* `@supabase/ssr` & `@supabase/supabase-js`: Backend database and auth connection libraries.
* `lucide-react`: SVG icon templates.
* `zod`: Request schema validators.

---

## 10. Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
```

---

## 11. Conclusion
**KhataMitra (खातामित्र)** successfully integrates Next.js, Supabase, and Google Gemini into an intelligent, accessible financial utility. By leveraging conversational AI tools, voice recognition, and real-time ledger triggers, it empowers Indian local retailers to modernize their ledger operations efficiently in their native language.
