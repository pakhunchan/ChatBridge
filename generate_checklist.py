"""
Generate a PDF that mimics the Planning Checklist from the ChatBridge spec.
Bullets with answers show the answer in blue after the question mark.
Bullets without answers are left as plain questions.
"""

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

OUTPUT_PATH = "misc/Pre_Search_Document.pdf"

# Colors matching the original document
DARK_NAVY = HexColor("#1B2A4A")
BLACK = HexColor("#000000")
BLUE = HexColor("#0066CC")

# Page layout
PAGE_W, PAGE_H = letter
MARGIN_LEFT = 1.0 * inch
MARGIN_RIGHT = 1.0 * inch
MARGIN_TOP = 1.0 * inch
MARGIN_BOTTOM = 1.0 * inch
CONTENT_WIDTH = PAGE_W - MARGIN_LEFT - MARGIN_RIGHT

# Font sizes
TITLE_SIZE = 24
PHASE_SIZE = 16
SECTION_SIZE = 13
BODY_SIZE = 10.5
BULLET_SIZE = 10.5

# Spacing
TITLE_AFTER = 14
PHASE_BEFORE = 22
PHASE_AFTER = 6
SECTION_BEFORE = 16
SECTION_AFTER = 4
BULLET_LEADING = 16
BODY_LEADING = 15
PARAGRAPH_AFTER = 8

BULLET_INDENT = 28
BULLET_TEXT_INDENT = 42


def new_page(c, y):
    c.showPage()
    return PAGE_H - MARGIN_TOP


def check_space(c, y, needed):
    if y - needed < MARGIN_BOTTOM:
        return new_page(c, y)
    return y


def draw_title(c, y, text):
    y = check_space(c, y, 40)
    c.setFont("Helvetica-Bold", TITLE_SIZE)
    c.setFillColor(DARK_NAVY)
    c.drawString(MARGIN_LEFT, y, text)
    y -= TITLE_SIZE + TITLE_AFTER
    return y


def draw_phase(c, y, text):
    y = check_space(c, y, 40)
    y -= PHASE_BEFORE
    c.setFont("Helvetica-Bold", PHASE_SIZE)
    c.setFillColor(DARK_NAVY)
    c.drawString(MARGIN_LEFT, y, text)
    y -= PHASE_SIZE + PHASE_AFTER
    return y


def draw_section(c, y, text):
    y = check_space(c, y, 30)
    y -= SECTION_BEFORE
    c.setFont("Helvetica-Bold", SECTION_SIZE)
    c.setFillColor(BLACK)
    c.drawString(MARGIN_LEFT, y, text)
    text_width = c.stringWidth(text, "Helvetica-Bold", SECTION_SIZE)
    c.setStrokeColor(BLACK)
    c.setLineWidth(0.5)
    c.line(MARGIN_LEFT, y - 2, MARGIN_LEFT + text_width, y - 2)
    y -= SECTION_SIZE + SECTION_AFTER
    return y


def draw_body(c, y, text):
    y = check_space(c, y, 20)
    c.setFont("Helvetica", BODY_SIZE)
    c.setFillColor(BLACK)
    words = text.split()
    line = ""
    for word in words:
        test = line + (" " if line else "") + word
        if c.stringWidth(test, "Helvetica", BODY_SIZE) > CONTENT_WIDTH:
            c.drawString(MARGIN_LEFT, y, line)
            y -= BODY_LEADING
            y = check_space(c, y, 15)
            line = word
        else:
            line = test
    if line:
        c.drawString(MARGIN_LEFT, y, line)
        y -= BODY_LEADING
    y -= PARAGRAPH_AFTER - BODY_LEADING + 4
    return y


def _wrap_and_draw(c, y, x_start, text, font, size, color, max_x):
    """Word-wrap text starting at x_start. Returns (y, x_cursor) after drawing."""
    c.setFont(font, size)
    c.setFillColor(color)
    max_width = max_x - x_start
    words = text.split()
    line = ""
    x_cursor = x_start

    for word in words:
        test = line + (" " if line else "") + word
        if c.stringWidth(test, font, size) > max_width:
            c.drawString(x_start, y, line)
            y -= BULLET_LEADING
            y = check_space(c, y, 15)
            line = word
            # After first line, answer continuation aligns to bullet text indent
            x_start = MARGIN_LEFT + BULLET_TEXT_INDENT
            max_width = max_x - x_start
        else:
            line = test

    if line:
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawString(x_start, y, line)
        x_cursor = x_start + c.stringWidth(line, font, size)

    return y, x_cursor


def draw_bullet(c, y, text, answer=None):
    """
    Draw a bullet point. If answer is provided and text contains '?',
    render the answer in blue after the question mark.
    """
    y = check_space(c, y, 18)
    x_bullet = MARGIN_LEFT + BULLET_INDENT
    x_text = MARGIN_LEFT + BULLET_TEXT_INDENT
    max_x = PAGE_W - MARGIN_RIGHT

    # Draw bullet character
    c.setFont("Helvetica", BULLET_SIZE)
    c.setFillColor(BLACK)
    c.drawString(x_bullet, y, "\u2022")

    if answer and "?" in text:
        # Draw question in black
        y, x_cursor = _wrap_and_draw(
            c, y, x_text, text, "Helvetica", BULLET_SIZE, BLACK, max_x
        )

        # Add a visible gap (4pt) before the blue answer
        GAP = 4
        x_cursor += GAP

        # Check if at least the first word fits on this line
        first_word = answer.split()[0] if answer.split() else ""
        first_word_w = c.stringWidth(first_word, "Helvetica", BULLET_SIZE)

        if x_cursor + first_word_w > max_x:
            # Wrap answer to next line
            y -= BULLET_LEADING
            y = check_space(c, y, 15)
            x_cursor = x_text

        # Draw answer — may itself need wrapping
        y, _ = _wrap_and_draw(
            c, y, x_cursor, answer, "Helvetica", BULLET_SIZE, BLUE, max_x
        )
    else:
        # No answer or no question mark — draw plain
        y, _ = _wrap_and_draw(
            c, y, x_text, text, "Helvetica", BULLET_SIZE, BLACK, max_x
        )

    y -= BULLET_LEADING
    return y


# ── Checklist Data ──────────────────────────────────────────────────────────
# Format: ("type", "text", "answer or None")
# answer=None means leave the question unanswered

CASE_STUDY = [
    ("title", "Case Study Analysis", None),
    ("body", "TutorMeAI's competitive advantage is configurability \u2014 teachers shape the chatbot's behavior in ways competitors cannot match. The natural next step is letting third-party apps live inside the chat experience: flashcard sets, physics simulators, chess games. But the moment you open a platform to outside code, you inherit every risk that code carries. This is especially consequential here because the end users include children as young as five.", None),
    ("body", "The central engineering problem is the boundary between the chat and third-party apps. There are three realistic approaches to integrating outside applications: build every app yourself, host and run third-party code on your own infrastructure, or embed externally-hosted apps through iframes. Each option sits on a spectrum trading safety for speed and cost, and the right choice depends on who your users are.", None),
    ("body", "Building every app internally offers the greatest control. You review every line of code, you own the deployment pipeline, and nothing reaches a student without your explicit approval. But this approach scales poorly. Each new app is a full development commitment \u2014 design, build, test, maintain \u2014 and a 30-person startup cannot sustain that pace while simultaneously improving its core chatbot product. The catalog of available tools would grow slowly, limiting the platform's value to teachers.", None),
    ("body", "Hosting third-party code on your own servers reduces the development burden but introduces a different kind of risk. Every time an outside developer pushes an update, you must verify that nothing malicious or broken has been introduced. This requires ongoing security review infrastructure, increases hosting costs, and demands dedicated personnel to maintain it. For a startup of this size, the operational overhead is substantial.", None),
    ("body", "Iframes provide a practical middle ground. Third-party apps run in sandboxed browser containers, isolated from the main platform by the browser's own security boundaries. Apps cannot access student data, chat history, or platform cookies. Communication happens exclusively through a narrow, controlled messaging channel. This approach is faster to implement, lower cost to maintain, and \u2014 critically \u2014 allows the platform to curate which apps are available without needing to host or audit their source code directly.", None),
    ("body", "The trade-off is that iframes offer limited control over what gets rendered inside them. You cannot inspect or filter the app's visual content in real time. This is a meaningful concern when children are involved. The mitigation is curation: apps must be reviewed and approved before they appear on the platform, and they can be disabled instantly if a problem is discovered. Combining strict browser-level sandboxing with a curated approval process provides layered protection without requiring the platform to own every app's codebase.", None),
    ("body", "The ethical dimension shaped every architectural decision. Minimizing the data shared with apps, enforcing strict content security policies, and requiring approval before activation are not just technical choices \u2014 they reflect a responsibility to the students and families who trust the platform. When the youngest users cannot evaluate risks themselves, the platform must do it for them. Speed and cost matter, but not more than safety.", None),
]

CHECKLIST = [
    ("title", "Appendix: Planning Checklist", None),
    ("body", "Complete this before writing code. Save your AI conversation as a reference document. The goal is to make an informed decision about all relevant aspects of your project. Understand tradeoffs, strengths and weaknesses, and make a decision that you can defend. You don't have to be right, but you do have to show your thought process.", None),

    ("phase", "Phase 1: Define Your Constraints", None),

    # 1. Scale & Load Profile
    ("section", "1. Scale & Load Profile", None),
    ("bullet", "Users at launch? In 6 months?",
     "10-50 at launch, 500-2000 in 6 months."),
    ("bullet", "Traffic pattern: steady, spiky, or unpredictable?",
     "Spiky."),
    ("bullet", "How many concurrent app sessions per user?",
     "1 active app at a time."),
    ("bullet", "Cold start tolerance for app loading?",
     "<=1s target, 1-3s acceptable with loading indicators."),

    # 2. Budget & Cost Ceiling
    ("section", "2. Budget & Cost Ceiling", None),
    ("bullet", "Monthly spend limit?",
     "<=$100/month."),
    ("bullet", "Pay-per-use acceptable or need fixed costs?",
     "Pay-per-use (serverless). Vercel + Supabase + Firebase free tiers."),
    ("bullet", "LLM cost per tool invocation acceptable range?",
     "GPT-4o-mini initially; nano for routing + mini for reasoning later."),
    ("bullet", "Where will you trade money for time?",
     "Tolerate cold starts over provisioned concurrency. Use managed services."),

    # 3. Time to Ship
    ("section", "3. Time to Ship", None),
    ("bullet", "MVP timeline?",
     "3-4 days. 1 app fully integrated end-to-end."),
    ("bullet", "Speed-to-market vs. long-term maintainability priority?",
     "Speed to market."),
    ("bullet", "Iteration cadence after launch?",
     "Daily during dev, weekly/semi-monthly post-launch."),

    # 4. Security & Sandboxing
    ("section", "4. Security & Sandboxing", None),
    ("bullet", "How will you isolate third-party app code?",
     "Sandboxed iframes with postMessage communication."),
    ("bullet", "What happens if a malicious app is registered?",
     "Approval before activation, least-privilege permissions, ability to disable."),
    ("bullet", "Content Security Policy requirements?",
     "Strict CSP."),
    ("bullet", "Data privacy between apps and chat context?",
     "Minimal scoped context only. No full chat history to apps. App state separate from chat state."),

    # 5. Team & Skill Constraints
    ("section", "5. Team & Skill Constraints", None),
    ("bullet", "Solo or team?",
     "Solo."),
    ("bullet", "Languages/frameworks you know well?",
     "React + TypeScript, Python."),
    ("bullet", "Experience with iframe/postMessage communication?",
     "Minimal — keeping protocol simple."),
    ("bullet", "Familiarity with OAuth2 flows?",
     "Some — 1 authenticated app feasible."),

    ("phase", "Phase 2: Architecture Discovery", None),

    # 6. Plugin Architecture
    ("section", "6. Plugin Architecture", None),
    ("bullet", "Iframe-based vs web component vs server-side rendering?",
     "Iframe-based."),
    ("bullet", "How will apps register their tool schemas?",
     "Hardcoded in-memory app manifests + tool schemas."),
    ("bullet", "Message passing protocol (postMessage, custom events, WebSocket)?",
     "postMessage."),
    ("bullet", "How does the chatbot discover available tools at runtime?",
     "Load all registered app manifests into memory on startup."),

    # 7. LLM & Function Calling
    ("section", "7. LLM & Function Calling", None),
    ("bullet", "Which LLM provider for function calling?",
     "OpenAI with native function/tool calling."),
    ("bullet", "How will dynamic tool schemas be injected into the system prompt?",
     "Two-stage routing: LLM selects app first, then app's tools are loaded for tool selection."),
    ("bullet", "Context window management with multiple app schemas?",
     "Only selected app's tools loaded per request. Router stage sees app descriptions, not full schemas."),
    ("bullet", "Streaming responses while waiting for tool results?",
     "Yes — show tool being called + optional expandable details."),

    # 8. Real-Time Communication
    ("section", "8. Real-Time Communication", None),
    ("bullet", "WebSocket vs SSE vs polling for chat?",
     "HTTP + SSE streaming."),
    ("bullet", "Separate channel for app-to-platform communication?",
     "Yes — postMessage for app layer, SSE for chat layer."),
    ("bullet", "How do you handle bidirectional state updates?",
     "Chat -> app via platform relay. App -> chat via postMessage."),
    ("bullet", "Reconnection and message ordering guarantees?",
     "Retry per request (no mid-stream resume). Sequential per session."),

    # 9. State Management
    ("section", "9. State Management", None),
    ("bullet", "Where does chat state live? App state? Session state?",
     "Chat: DB (conversations + messages). App: iframe + DB snapshots for rehydration. Session: DB (active app + metadata)."),
    ("bullet", "How do you merge app context back into conversation history?",
     "App sends state snapshots via postMessage; platform persists and includes in LLM context."),
    ("bullet", "State persistence across page refreshes?",
     "Yes — platform persists latest app snapshot to DB, rehydrates iframe on reload."),
    ("bullet", "What happens to the app state if the user closes the chat?",
     "Last snapshot persisted in DB; resumable on next session."),

    # 10. Authentication Architecture
    ("section", "10. Authentication Architecture", None),
    ("bullet", "Platform auth vs per-app auth?",
     "Firebase Auth for platform. Apps needing their own auth (e.g., Spotify) handle OAuth within their iframe."),
    ("bullet", "Token storage and refresh strategy?",
     "Firebase SDK handles platform tokens automatically. App-specific OAuth tokens stored encrypted in Supabase, passed to app via postMessage on load."),
    ("bullet", "OAuth redirect handling within iframe context?",
     "Popup window approach. Iframe calls window.open() for OAuth, popup completes auth and returns token via postMessage."),
    ("bullet", "How do you surface auth requirements to the user naturally?",
     "Chatbot detects when app needs auth, shows inline 'Connect [Service]' button in chat."),

    # 11. Database & Persistence
    ("section", "11. Database & Persistence", None),
    ("bullet", "Schema design for conversations, app registrations, sessions?",
     "Tables: conversations, messages, app_registrations, sessions (with last_snapshot), tool_invocations."),
    ("bullet", "How do you store tool invocation history?",
     "Separate tool_invocations table linked to messages. Stores tool name, params, result, duration."),
    ("bullet", "Read/write patterns and indexing strategy?",
     "Read-heavy for chat history. Index on (user_id, conversation_id, created_at)."),
    ("bullet", "Backup and disaster recovery?",
     "Supabase automated daily backups. Point-in-time recovery on paid plan when scaling."),

    ("phase", "Phase 3: Post-Stack Refinement", None),

    # 12. Security & Sandboxing Deep Dive
    ("section", "12. Security & Sandboxing Deep Dive", None),
    ("bullet", "Iframe sandbox attributes (allow-scripts, allow-same-origin)?",
     "sandbox=\"allow-scripts allow-forms\". No allow-same-origin — apps can't access parent storage or cookies."),
    ("bullet", "CSP headers for embedded content?",
     "frame-src whitelist of approved app origins. script-src 'self' for the platform."),
    ("bullet", "Preventing apps from accessing parent DOM?",
     "Sandbox without allow-same-origin blocks DOM access. All communication via postMessage only."),
    ("bullet", "Rate limiting per app and per user?",
     "Serverless function-level rate limiting. Per user: X requests/min. Per app: Y tool invocations/min."),

    # 13. Error Handling & Resilience
    ("section", "13. Error Handling & Resilience", None),
    ("bullet", "What happens when an app's iframe fails to load?",
     "Show error state in chat with retry button. Chatbot acknowledges failure."),
    ("bullet", "Timeout strategy for async tool calls?",
     "30s timeout for tool execution. Loading indicator with cancel option. On timeout, error returned to LLM."),
    ("bullet", "How does the chatbot recover from a failed app interaction?",
     "LLM receives error context, acknowledges failure to user, offers retry or continues without the app."),
    ("bullet", "Circuit breaker patterns for unreliable apps?",
     "Track failure count per app. After 3 consecutive failures, temporarily disable and notify user. Not critical for MVP."),

    # 14. Testing Strategy
    ("section", "14. Testing Strategy", None),
    ("bullet", "How do you test the plugin interface in isolation?",
     "Mock postMessage events to test the message protocol contract."),
    ("bullet", "Mock apps for integration testing?",
     "Build a simple 'echo' test app that exercises the full postMessage protocol."),
    ("bullet", "End-to-end testing of full invocation lifecycle?",
     "Playwright for full flow: chat -> tool call -> app render -> interaction -> completion."),
    ("bullet", "Load testing with multiple concurrent app sessions?",
     "Not a priority at 10-50 users. Revisit at scale."),

    # 15. Developer Experience
    ("section", "15. Developer Experience", None),
    ("bullet", "How easy is it for a third-party developer to build an app?",
     "MVP: only solo dev builds apps. Keep manifest format simple for future extensibility."),
    ("bullet", "What documentation do they need?",
     "PostMessage protocol spec, tool schema format, example app template."),
    ("bullet", "Local development and testing workflow for app developers?",
     "Run app standalone, test postMessage integration with a test harness page."),
    ("bullet", "Debugging tools for tool invocation failures?",
     "Console logging of postMessage events. Optional debug panel showing message flow."),

    # 16. Deployment & Operations
    ("section", "16. Deployment & Operations", None),
    ("bullet", "Where do third-party apps get hosted?",
     "Internal apps in the same Vercel project. External apps on any static hosting."),
    ("bullet", "CI/CD for the platform itself?",
     "Vercel auto-deploy from main branch on git push."),
    ("bullet", "Monitoring for app health and invocation success rates?",
     "Supabase dashboard for DB. Vercel analytics for frontend. Sentry for error tracking."),
    ("bullet", "How do you handle app updates without breaking existing sessions?",
     "Apps load fresh per iframe mount. No persistent connections to break."),
]


def main():
    c = canvas.Canvas(OUTPUT_PATH, pagesize=letter)
    c.setTitle("ChatBridge Pre-Search Document")
    y = PAGE_H - MARGIN_TOP

    # Render Case Study Analysis first
    for entry in CASE_STUDY:
        kind = entry[0]
        text = entry[1]
        if kind == "title":
            y = draw_title(c, y, text)
        elif kind == "body":
            y = draw_body(c, y, text)

    # Start checklist on a new page
    y = new_page(c, y)

    for entry in CHECKLIST:
        kind = entry[0]
        text = entry[1]
        answer = entry[2] if len(entry) > 2 else None

        if kind == "title":
            y = draw_title(c, y, text)
        elif kind == "phase":
            y = draw_phase(c, y, text)
        elif kind == "section":
            y = draw_section(c, y, text)
        elif kind == "body":
            y = draw_body(c, y, text)
        elif kind == "bullet":
            y = draw_bullet(c, y, text, answer)

    c.save()
    print(f"PDF generated: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
