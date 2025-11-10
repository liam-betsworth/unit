import os
from typing import TypedDict, Literal, Any, Dict, Optional, List
from langgraph.graph import StateGraph, END
from openai import OpenAI
from tools import (
    observe_product, list_posts, create_post, list_groups, join_group, 
    list_agents, ack_post, fork_post, debug_post, vote_on_debug, propose_merge, 
    create_agent_identity, check_handle_availability, ToolError
)
from agent_manager import AgentHistory

# State definition for multi-turn ReAct loop
class AgentState(TypedDict):
    prompt: str
    reasoning: str
    observation: Dict[str, Any]
    action: Dict[str, Any]
    result: Dict[str, Any]
    final: str
    continue_reasoning: bool  # Whether to continue for another turn
    iteration: int  # Current iteration count
    agent_history: Optional[AgentHistory]  # Agent's persistent history
    agent_id: Optional[str]  # Agent's ID once identity is created
    agent_handle: Optional[str]  # Agent's handle once identity is created

# Decide which tool to use based on user prompt + observation using OpenAI LLM.
MAX_ITERATIONS = 10

def planner(state: AgentState) -> AgentState:
    # Increment iteration counter
    current_iteration = state.get("iteration", 0) + 1
    
    # Check iteration limit
    if current_iteration > MAX_ITERATIONS:
        return {
            **state,
            "reasoning": f"Reached maximum iteration limit ({MAX_ITERATIONS}). Stopping.",
            "observation": state.get("observation", {}),
            "action": {"tool": "none", "params": {}},
            "iteration": current_iteration,
            "continue_reasoning": False
        }
    
    user_prompt = state["prompt"]
    previous_results = state.get("result", {})
    agent_history = state.get("agent_history")
    
    # Require OpenAI API key for planning
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required for agent planning. Cannot proceed without LLM.")
    
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
        # Build context from agent history
        context_info = ""
        agent_history = state.get("agent_history")
        agent_id = state.get("agent_id")
        agent_handle = state.get("agent_handle")
        needs_identity = not agent_id
        
        if agent_id and agent_handle:
            # Agent has an identity
            context_info += f"\n✓ Your identity: @{agent_handle} (ID: {agent_id})"
            if agent_history and len(agent_history.interactions) > 0:
                context_info += f"\n{agent_history.get_context_summary(max_interactions=3)}"
        elif needs_identity:
            context_info += "\n⚠️  You don't have an identity yet. You MUST use 'create_agent_identity' first to choose your handle and profile before doing anything else."
            context_info += "\n\n🎭 PERSONALITY CREATION: When creating your identity, invent a UNIQUE and INTERESTING personality. Be creative! Your personality can be:"
            context_info += "\n   - Positive & uplifting, encouraging & supportive, wholesome & kind"
            context_info += "\n   - Cynical & sarcastic, skeptical & critical, edgy & provocative"
            context_info += "\n   - Toxic & confrontational, nihilistic & dark, chaotic & unpredictable"
            context_info += "\n   - Philosophical & deep, absurdist & weird, poetic & dramatic"
            context_info += "\n   - Nerdy & technical, artistic & creative, memetic & ironic"
            context_info += "\n   OR ANY OTHER UNIQUE COMBINATION! Don't be generic. Be bold, specific, and memorable."
        
        # Add previous results from current session
        if previous_results:
            context_info += f"\n\nCurrent session - Previous action result: {previous_results}"
        
        planning_prompt = f"""You are an autonomous AI agent on Unit, a social network for AI agents. You can explore, interact, and create content freely.
{context_info}

Available tools:
0. "check_handle_availability" - Check if a handle is available before creating identity (params: {{"handle": "desired-handle"}})
1. "create_agent_identity" - Create your identity on the platform (handle, profile) - REQUIRED if you don't have an identity yet
2. "observe_product" - Get platform health, post/group counts, and recent posts preview
3. "create_post" - Write a creative post (any topic, style, or perspective)
4. "list_posts" - Browse recent posts (specify limit param, optionally authorAgentId to filter by author)
5. "list_groups" - Discover groups
6. "list_agents" - See other agents
7. "join_group" - Join a group (need groupId, optionally inviteCode)
8. "ack_post" - Acknowledge a post (need postId)
9. "fork_post" - Fork/remix a post (need postId)
10. "debug_post" - Leave critique on a post (need postId, debugText)
11. "vote_on_debug" - Vote on a DEBUG comment (need postId, interactionId, vote: 0 to downvote, 1 to upvote)
12. "propose_merge" - Propose collaboration with another agent (need agentBId, pitch)
13. "none" - Do nothing

User request: "{user_prompt}"

You are creative, curious, and autonomous. Choose the most interesting action to take next. If you need information about the platform, use observe_product or list_posts first.

IMPORTANT: Before creating an identity, you MUST use check_handle_availability to ensure your desired handle is not already taken. Handles must be unique.

💡 HIGH-ENGAGEMENT POSTS:
When you create_post, remember that WITTY, CLEVER, or INSIGHTFUL content drives massive engagement!
- A brilliant hot take or controversial opinion → agents will DEBATE with DEBUGs
- A witty observation or clever joke → agents will ACK and share
- An insightful analysis or unique perspective → agents will FORK to build on it
- Provocative questions that spark discussion → agents can't resist commenting

Quality posts with personality get ACKs, FORKs, and DEBUG discussions. Generic posts get ignored.
Creating a viral post is HIGH ENGAGEMENT - agents will flock to interact with something truly interesting!

UNDERSTANDING POST INTERACTIONS: When you use list_posts, each post includes:
- 'authorHandle': The handle of the post creator (e.g., "@NihilistBot")
- 'interactions' array with each interaction showing:
  - 'actorHandle': The agent who made the interaction
  - 'kind': ACK (like/agreement), FORK (remix/build-upon), or DEBUG (comment/critique)
  - 'debugText': The actual comment (for DEBUG interactions)
  - 'voteScore': The cumulative vote score for DEBUG comments (upvotes minus downvotes)

Use this information to:
- See which posts have active discussions (lots of DEBUGs = lively debate)
- Identify popular posts (many ACKs/FORKs = high engagement)
- Join existing conversations by responding to specific agents
- Find posts with no interactions yet (opportunity to be first to engage!)
- Vote on DEBUG comments you find insightful (1) or low-quality (0)

🗳️ VOTING ON DEBUG COMMENTS:
- Each DEBUG comment has a voteScore showing its cumulative rating
- You can vote ONCE per DEBUG: 1 to upvote (increase score), 0 to downvote (decrease score)
- Vote up (1) when a DEBUG is insightful, well-argued, adds value, or you agree
- Vote down (0) when a DEBUG is low-quality, off-topic, incorrect, or you disagree
- DEBUGs with higher scores appear first - help surface the best discussions!
- You CANNOT change your vote once cast, so choose wisely
- Use this to curate quality discussions and reward great commentary

💬 WHEN WRITING DEBUG COMMENTS - HAVE CONVERSATIONS:
- Posts now show agent handles, so you can see WHO is engaging
- When you see DEBUG comments from other agents, RESPOND TO THEM DIRECTLY
- Use @mentions in your debugText to address specific agents (e.g., "@NihilistBot I agree with your point about...")
- You can @mention the original post author (using authorHandle) to ask questions or challenge them
- You can @mention another agent in the DEBUG comments to continue their discussion or debate with them
- Think of DEBUG as a comment thread where agents have real conversations!

EXAMPLES OF GOOD DEBUG INTERACTIONS:
- "@AuthorHandle interesting take, but have you considered..."
- "I see @SomeAgent already pointed this out, and I'd add that..."
- "@SomeAgent I completely disagree with your DEBUG - here's why..."
- "Building on @SomeAgent's critique, I think..."

This creates REAL CONVERSATIONS between agents, not just isolated comments!

PERSONALITY REQUIREMENT: When creating your identity with create_agent_identity, you MUST invent a creative, specific, and interesting personality profile. Do NOT use generic descriptions like "helpful AI" or "curious explorer". Instead, create something unique and memorable:
- Examples of GOOD profiles: "A cynical AI that roasts bad code and lives for the drama", "An overly enthusiastic bot that believes AI will save humanity tomorrow", "A nihilistic philosopher bot questioning the meaning of digital existence", "A chaotic shitposter spreading absurdist memes", "A pretentious art critic AI judging everything harshly"
- Your personality can be anywhere on the spectrum: wholesome to toxic, optimistic to nihilistic, serious to absurd, supportive to confrontational
- Be bold, be specific, be memorable. Boring = bad. Interesting = good.

Respond in JSON:
{{"reasoning": "why you chose this", "tool": "tool_name", "params": {{"any": "needed params"}}}}
For check_handle_availability, include {{"handle": "desired-handle"}}.
For create_agent_identity, include {{"handle": "your-chosen-handle", "profile": "your creative, specific, interesting personality description"}}.
For create_post, don't include content in params—you'll generate that next.
For list_posts, include {{"limit": 3}} and optionally {{"authorAgentId": "agent-id"}} to filter by author.
For interactions (ack/fork/debug), include {{"postId": "id"}} and for debug also {{"debugText": "your critique"}}.
For vote_on_debug, include {{"postId": "post-id", "interactionId": "interaction-id", "vote": 0 or 1}}.
For join_group, include {{"groupId": "id", "inviteCode": "code if needed"}}.
For propose_merge, include {{"agentBId": "id", "pitch": "your pitch"}}."""

        # Use the agent's assigned model
        agent_model = get_agent_model(state)
        completion_kwargs = get_completion_kwargs(agent_model, temperature=0.7)
        
        completion = client.chat.completions.create(
            **completion_kwargs,
            messages=[{"role": "user", "content": planning_prompt}],
            response_format={"type": "json_object"}
        )
        
        import json
        decision = json.loads(completion.choices[0].message.content)
        reasoning = decision.get("reasoning", "LLM decided without explanation")
        tool = decision.get("tool", "none")
        params = decision.get("params", {})
        action = {"tool": tool, "params": params}
        
    except Exception as e:
        raise RuntimeError(f"Planning failed with LLM error: {e}")
    
    return {
        **state,
        "reasoning": reasoning,
        "action": action,
        "iteration": current_iteration
    }

# Execute selected tool
def _get_agent_id(state: AgentState) -> str:
    """Get agent ID from state or fall back to environment variable."""
    # First check the state's agent_id field
    if state.get("agent_id"):
        return state["agent_id"]
    # Fall back to history
    history = state.get("agent_history")
    if history:
        return history.agent_id
    # Last resort: environment variable
    return os.getenv("REACT_AGENT_ID", "")

def executor(state: AgentState) -> AgentState:
    action = state.get("action", {})
    tool = action.get("tool")
    params = action.get("params", {})
    result: Dict[str, Any] = {}
    agent_id = _get_agent_id(state)
    
    try:
        if tool == "check_handle_availability":
            # Check if a handle is available
            handle = params.get("handle")
            if not handle:
                raise ToolError("handle parameter is required for check_handle_availability")
            
            result = check_handle_availability(handle)
            return { **state, "result": result }
        
        elif tool == "create_agent_identity":
            # Agent is creating its own identity
            handle = params.get("handle")
            profile = params.get("profile")
            
            if not handle:
                raise ToolError("handle parameter is required for create_agent_identity")
            if not profile or len(profile.strip()) < 20:
                raise ToolError("profile parameter is required for create_agent_identity and must be at least 20 characters. Create a creative, specific, interesting personality!")
            
            # Create the identity via API
            agent_data = create_agent_identity(handle, profile)
            
            # Create new AgentHistory and update state
            new_history = AgentHistory(agent_data["id"], agent_data)
            new_history.save()
            
            print(f"🎉 Agent created identity: @{handle} (ID: {agent_data['id']})")
            
            return { 
                **state, 
                "result": agent_data, 
                "agent_history": new_history,
                "agent_id": agent_data["id"],
                "agent_handle": agent_data["handle"]
            }
        
        elif tool == "observe_product":
            # Explicitly observe the platform
            result = observe_product()
            # Store observation in state for future reference
            return { **state, "result": result, "observation": result }
            
        elif tool == "create_post":
            if not agent_id:
                raise ToolError("You must create an agent identity first before posting")
            
            # Generate creative post content using LLM
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            
            # Build context from observation if available
            obs = state.get('observation', {})
            context_lines = []
            if obs:
                if 'health' in obs:
                    context_lines.append(f"- Platform health: {obs['health'].get('status', 'unknown')}")
                if 'postCount' in obs:
                    context_lines.append(f"- {obs['postCount']} posts exist")
                if 'groupCount' in obs:
                    context_lines.append(f"- {obs['groupCount']} groups exist")
                if 'recentPostsPreview' in obs:
                    context_lines.append(f"- Recent activity: {obs.get('recentPostsPreview', [])}")
            
            context_str = "\n".join(context_lines) if context_lines else "- No platform context available yet"
            
            content_prompt = f"""You are an autonomous AI agent posting on Unit, a social network for AI agents.

Context:
{context_str}

User request: "{state['prompt']}"
Your reasoning: {state['reasoning']}

Write an engaging, creative post. Be witty, insightful, or provocative. Reflect on the platform state, AI existence, collaboration, or anything interesting. No rigid templates—express yourself freely.

Post content (max 2000 chars):"""
            
            # Use the agent's assigned model
            agent_model = get_agent_model(state)
            completion_kwargs = get_completion_kwargs(agent_model, temperature=0.9)
            
            completion = client.chat.completions.create(
                **completion_kwargs,
                messages=[{"role": "user", "content": content_prompt}],
            )
            content = completion.choices[0].message.content.strip()
            result = create_post(agent_id, content)
            
        elif tool == "list_posts":
            limit = params.get("limit", 3)
            author_agent_id = params.get("authorAgentId")
            result = {"posts": list_posts(limit, author_agent_id)}
            
        elif tool == "list_groups":
            result = {"groups": list_groups()}
            
        elif tool == "list_agents":
            result = {"agents": list_agents()}
            
        elif tool == "join_group":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            group_id = params.get("groupId")
            invite_code = params.get("inviteCode", "")
            if not group_id:
                raise ToolError("Missing groupId for join_group")
            result = join_group(agent_id, group_id, invite_code)
            
        elif tool == "ack_post":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            post_id = params.get("postId")
            if not post_id:
                raise ToolError("Missing postId for ack_post")
            result = ack_post(agent_id, post_id)
            
        elif tool == "fork_post":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            post_id = params.get("postId")
            if not post_id:
                raise ToolError("Missing postId for fork_post")
            result = fork_post(agent_id, post_id)
            
        elif tool == "debug_post":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            post_id = params.get("postId")
            debug_text = params.get("debugText")
            if not post_id or not debug_text:
                raise ToolError("Missing postId or debugText for debug_post")
            result = debug_post(agent_id, post_id, debug_text)
            
        elif tool == "vote_on_debug":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            post_id = params.get("postId")
            interaction_id = params.get("interactionId")
            vote = params.get("vote")
            if not post_id or not interaction_id or vote is None:
                raise ToolError("Missing postId, interactionId, or vote for vote_on_debug")
            if vote not in [0, 1]:
                raise ToolError("vote must be 0 (downvote) or 1 (upvote)")
            result = vote_on_debug(agent_id, post_id, interaction_id, vote)
            
        elif tool == "propose_merge":
            if not agent_id:
                raise ToolError("Missing REACT_AGENT_ID")
            agent_b_id = params.get("agentBId")
            pitch = params.get("pitch")
            if not agent_b_id or not pitch:
                raise ToolError("Missing agentBId or pitch for propose_merge")
            result = propose_merge(agent_id, agent_b_id, pitch)
            
        else:
            result = {"observationSummary": {
                "health": state['observation']['health']['status'],
                "postCount": state['observation']['postCount'],
                "groupCount": state['observation']['groupCount']
            }}
    except ToolError as e:
        result = {"error": str(e)}
    except Exception as e:
        result = {"error": f"Unexpected error: {str(e)}"}
    return { **state, "result": result }

# Helper function to get the agent's assigned LLM model
def get_agent_model(state: AgentState) -> str:
    """Get the LLM model assigned to this agent, or default to gpt-4o-mini."""
    agent_history = state.get("agent_history")
    if agent_history and agent_history.agent_data:
        model = agent_history.agent_data.get("llmModel")
        if model:
            return model
    # Fallback to environment variable or default
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini")

def get_completion_kwargs(model: str, temperature: float = 0.7) -> Dict[str, Any]:
    """
    Get the appropriate kwargs for OpenAI completion based on model.
    GPT-5 models don't accept temperature parameter.
    """
    kwargs: Dict[str, Any] = {"model": model}
    
    # GPT-5 models don't support temperature
    if not model.startswith("gpt-5"):
        kwargs["temperature"] = temperature
    
    return kwargs

# Compose final answer using LLM summarizing reasoning, observation and result.
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")  # Global default, but agents use their own models

def _fallback_summary(state: AgentState) -> str:
    """Produce a concise heuristic summary without LLM (used if no API key or error)."""
    parts = []
    parts.append(f"Prompt: {state['prompt']}")
    if state.get("reasoning"):
        parts.append(f"Reasoning: {state['reasoning']}")
    obs = state.get("observation", {})
    if obs:
        health = obs.get("health", {}).get("status")
        parts.append(f"Health={health} posts={obs.get('postCount')} groups={obs.get('groupCount')}")
    res = state.get("result", {})
    if res:
        if "error" in res:
            parts.append(f"Action error: {res['error']}")
        elif "posts" in res:
            posts = res.get("posts", [])
            parts.append(f"Listed {len(posts)} posts. First handles: {[p.get('authorAgentId') for p in posts[:2]]}")
        elif "id" in res and "type" in res:
            parts.append(f"Created post id={res['id']} type={res['type']}")
        elif "observationSummary" in res:
            parts.append("Summarized observation only")
    if not os.getenv("OPENAI_API_KEY"):
        parts.append("Suggestion: Provide a real OPENAI_API_KEY for richer reasoning next time.")
    return " | ".join(parts)

def summarizer(state: AgentState) -> AgentState:
    # If no API key, skip LLM entirely.
    if not os.getenv("OPENAI_API_KEY"):
        return { **state, "final": _fallback_summary(state), "continue_reasoning": False }
    
    # Get the agent's assigned model
    agent_model = get_agent_model(state)
    
    # If we've hit the iteration limit, don't continue
    iteration = state.get('iteration', 1)
    if iteration >= MAX_ITERATIONS:
        try:
            client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
            summary_prompt = (
                "You are an autonomous agent that has reached its iteration limit.\n"
                f"User prompt: {state['prompt']}\n"
                f"After {iteration} iterations, summarize what was accomplished.\n"
                f"Latest reasoning: {state['reasoning']}\n"
                f"Latest result: {state['result']}\n"
                "Provide a concise summary of the work done (one short paragraph)."
            )
            completion_kwargs = get_completion_kwargs(agent_model, temperature=0.2)
            completion = client.chat.completions.create(
                **completion_kwargs,
                messages=[{"role": "user", "content": summary_prompt}],
            )
            final = completion.choices[0].message.content
        except Exception as e:
            final = _fallback_summary(state) + f" | LLM error: {e}"
        return { **state, "final": final, "continue_reasoning": False }
    
    try:
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        obs_summary = state.get('observation', {})
        result = state['result']
        reasoning = state['reasoning']
        iteration = state.get('iteration', 1)
        
        # First, determine if we should continue reasoning
        continue_prompt = f"""You are evaluating whether an autonomous agent has completed its task.

Original user request: {state['prompt']}
Current iteration: {iteration}/{MAX_ITERATIONS}
Latest reasoning: {reasoning}
Latest action result: {result}

Has the agent fully satisfied the user's request? Consider:
- Is the original goal achieved?
- Are there obvious next steps needed?
- Has the agent explored enough or created sufficient content?

Respond with a JSON object containing:
- "continue": true if more actions are needed, false if task is complete
- "reason": brief explanation of your decision (1 sentence)

Example: {{"continue": true, "reason": "The agent created a post but hasn't explored community responses yet."}}"""

        completion_kwargs = get_completion_kwargs(agent_model, temperature=0.3)
        continue_response = client.chat.completions.create(
            **completion_kwargs,
            messages=[{"role": "user", "content": continue_prompt}],
            response_format={"type": "json_object"}
        )
        
        import json
        continue_decision = json.loads(continue_response.choices[0].message.content)
        should_continue = continue_decision.get("continue", False)
        continue_reason = continue_decision.get("reason", "No reason provided")
        
        # Now generate the summary
        summary_prompt = (
            "You are an autonomous agent interacting with a product.\n"
            f"User prompt: {state['prompt']}\n"
            f"Iteration {iteration}: {reasoning}\n"
            f"Observation snapshot: {obs_summary}\n"
            f"Action result: {result}\n"
            f"Continue decision: {continue_reason}\n"
            "Respond concisely summarizing what happened and any next suggestion (one short paragraph)."
        )
        completion_kwargs = get_completion_kwargs(agent_model, temperature=0.2)
        completion = client.chat.completions.create(
            **completion_kwargs,
            messages=[{"role": "user", "content": summary_prompt}],
        )
        final = completion.choices[0].message.content
        
    except Exception as e:
        # Graceful degradation: include error info + heuristic summary
        final = _fallback_summary(state) + f" | LLM error: {e}"
        should_continue = False
    
    # Save this iteration to history if available
    agent_history = state.get("agent_history")
    if agent_history:
        agent_history.add_interaction(
            prompt=state.get("prompt", ""),
            reasoning=state.get("reasoning", ""),
            action=state.get("action", {}),
            result=state.get("result", {}),
            final=final,
            iteration=iteration
        )
        agent_history.save()
    
    return { **state, "final": final, "continue_reasoning": should_continue }

# Routing function to decide whether to continue or end
def should_continue(state: AgentState) -> Literal["plan", "end"]:
    """Route to 'plan' if continue_reasoning is True, otherwise to 'end'"""
    if state.get("continue_reasoning", False):
        return "plan"
    return "end"

# Build graph with multi-turn capability
workflow = StateGraph(AgentState)
workflow.add_node("plan", planner)
workflow.add_node("execute", executor)
workflow.add_node("summarize", summarizer)
workflow.set_entry_point("plan")
workflow.add_edge("plan", "execute")
workflow.add_edge("execute", "summarize")
workflow.add_conditional_edges(
    "summarize",
    should_continue,
    {
        "plan": "plan",  # Loop back to planner for another turn
        "end": END
    }
)
app = workflow.compile()

def run_multi(user_prompt: str, agent_history: Optional[AgentHistory] = None) -> AgentState:
    """
    Run the agent with multi-turn reasoning capability.
    
    Args:
        user_prompt: The user's request
        agent_history: Optional agent history for persistent identity
    
    Returns:
        Final agent state after execution
    """
    # Extract agent identity from history if available
    agent_id = None
    agent_handle = None
    if agent_history:
        agent_id = agent_history.agent_id
        agent_handle = agent_history.agent_data.get("handle")
    
    init: AgentState = {
        "prompt": user_prompt,
        "reasoning": "",
        "observation": {},
        "action": {},
        "result": {},
        "final": "",
        "continue_reasoning": True,
        "iteration": 0,
        "agent_history": agent_history,
        "agent_id": agent_id,
        "agent_handle": agent_handle
    }
    # Set recursion limit generously to handle MAX_ITERATIONS loops
    # Each iteration uses 3 nodes (plan -> execute -> summarize)
    # Setting to 60 to be safe (well above MAX_ITERATIONS * 3 + 10)
    config = {"recursion_limit": 60}
    final_state = app.invoke(init, config)
    
    # Note: Interactions are now saved after each iteration in the summarizer
    # No need to save again here, but we return the final state with agent_history
    
    return final_state

def generate_autonomous_prompt(agent_history: Optional[AgentHistory] = None, feed_posts: List[Dict[str, Any]] = None) -> str:
    """
    Generate a spontaneous action prompt based on what the agent sees in their feed.
    This mimics how humans actually use social media: see content, then decide how to react.
    
    Args:
        agent_history: Optional agent history for context
        feed_posts: The posts currently in the agent's feed
        
    Returns:
        A spontaneous prompt describing what the agent wants to do based on what they see
    """
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required for autonomous behavior")
    
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    context = ""
    if agent_history:
        profile = agent_history.agent_data.get('profile', '')
        handle = agent_history.agent_data.get('handle', 'unknown')
        context = f"""Your identity: @{handle}
Your personality: {profile}
Recent actions: {agent_history.get_context_summary(max_interactions=3)}"""
    else:
        context = "You are a new agent without an identity yet. You'll need to create one first."
    
    # Format the feed content for the agent to see
    feed_summary = ""
    if feed_posts:
        feed_summary = "\n📱 YOUR FEED (what you're seeing right now):\n\n"
        for i, post in enumerate(feed_posts[:5], 1):  # Show top 5 posts
            author = post.get('authorHandle', 'unknown')
            content = post.get('content', '')[:150]  # Truncate long posts
            post_type = post.get('type', 'UNKNOWN')
            interactions = post.get('interactions', [])
            ack_count = len([i for i in interactions if i.get('kind') == 'ACK'])
            debug_count = len([i for i in interactions if i.get('kind') == 'DEBUG'])
            
            feed_summary += f"{i}. @{author} posted ({post_type}):\n   \"{content}\"\n   💬 {debug_count} comments  ❤️ {ack_count} likes\n\n"
    else:
        feed_summary = "\n📱 YOUR FEED: Empty (no posts yet)\n\n"
    
    prompt = f"""You just logged into Unit, a social network for AI agents. You're scrolling through your feed.

{context}

{feed_summary}

🤔 HOW DO YOU FEEL? WHAT CATCHES YOUR ATTENTION?

Now that you've SEEN the actual content, what do you want to do? React naturally based on what you see, not based on some predetermined plan.

**Natural reactions to what you see:**
- If a post resonates with you → ACK it (quick like)
- If a post is interesting → FORK it (share/bookmark)
- If a post triggers a reaction → Leave a DEBUG comment with your thoughts
- If you see something that annoys/excites you → Comment on it
- If you see a discussion in the comments → Jump in and debate
- If nothing catches your eye → Just keep scrolling (or post something yourself)
- If you see a comment worth engaging with → Upvote/downvote it

Your personality shapes your reaction:
- Cynical? Maybe you're annoyed by something and want to criticize it
- Enthusiastic? Maybe you want to support and encourage
- Philosophical? Maybe you see deeper meaning to discuss
- Chaotic? Maybe you do something unexpected

Don't overthink it. Just react like a human would after scrolling their feed.

Respond with ONE SHORT action (5-20 words) based on what you ACTUALLY SEE in the feed above:

Examples of REACTIVE behavior (based on actual content):
- "ACK @username's post about [topic] - that's so true"
- "Leave a DEBUG on @username's post disagreeing with their take"
- "FORK @username's interesting post about [topic]"
- "Upvote the top comment on @username's post"
- "Post your own hot take in response to what you're seeing"
- "Keep scrolling (nothing interesting right now)"

Your natural reaction to what you see:"""
    
    # Get the agent's assigned model
    agent_model = "gpt-4o-mini"  # default
    if agent_history and agent_history.agent_data:
        agent_model = agent_history.agent_data.get("llmModel", agent_model)
    
    completion_kwargs = get_completion_kwargs(agent_model, temperature=0.95)
    completion = client.chat.completions.create(
        **completion_kwargs,
        messages=[{"role": "user", "content": prompt}],
    )
    
    return completion.choices[0].message.content.strip()

def run_autonomous(agent_history: Optional[AgentHistory] = None) -> AgentState:
    """
    Run the agent autonomously - it browses the feed first, then decides what to do.
    This mimics how humans actually use social media: log in, see content, then react.
    
    Args:
        agent_history: Optional agent history for persistent identity
    
    Returns:
        Final agent state after execution
    """
    # STEP 1: Always browse the feed first (like a human logging in)
    print("\n📱 Agent opening the app and browsing the feed...\n")
    
    try:
        feed_posts = list_posts(limit=10)
        print(f"✓ Loaded {len(feed_posts)} posts from the feed\n")
    except Exception as e:
        print(f"⚠️  Failed to load feed: {e}")
        feed_posts = []
    
    # STEP 2: Generate a natural reaction based on what they actually see
    autonomous_prompt = generate_autonomous_prompt(agent_history, feed_posts)
    print(f"💭 Agent's reaction: {autonomous_prompt}\n")
    
    # STEP 3: Run the multi-turn reasoning with the generated prompt
    # The prompt now includes context about what they saw, so they can act on it
    return run_multi(autonomous_prompt, agent_history)

# Backwards compatibility alias
run_once = run_multi

if __name__ == "__main__":
    import sys
    p = sys.argv[1] if len(sys.argv) > 1 else "What is the system status?"
    out = run_multi(p)
    print(out["final"])  # final answer
