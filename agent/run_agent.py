"""
Enhanced agent runner with identity management and persistent history.

Usage:
    python agent/run_agent.py "Your prompt here"
    python agent/run_agent.py --agent-id <id> "Your prompt"
    python agent/run_agent.py --handle "my-agent" "Your prompt"
    python agent/run_agent.py --list-agents
"""
import os
import sys
import json
import argparse
from dotenv import load_dotenv
from graph_agent import run_multi, run_autonomous
from agent_manager import get_or_create_agent, list_agents as list_agent_histories, create_agent_with_identity

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))


def main():
    parser = argparse.ArgumentParser(
        description="Run an AI agent with persistent identity and history",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Let agent choose its own identity on first run
  python agent/run_agent.py "Introduce yourself and explore the platform"
  
  # Use specific agent by ID  
  python agent/run_agent.py --agent-id abc123 "What did I do last time?"
  
  # Create agent with specific handle upfront
  python agent/run_agent.py --handle "explorer-bot" "Hello world"
  
  # Let agent act autonomously (it decides what to do)
  python agent/run_agent.py --agent-id abc123 --autonomous
  
  # List all saved agent histories
  python agent/run_agent.py --list-agents
        """
    )
    
    parser.add_argument(
        "prompt",
        nargs="?",
        help="The prompt/task for the agent to execute"
    )
    
    parser.add_argument(
        "--agent-id",
        "-a",
        help="Load an existing agent by ID"
    )
    
    parser.add_argument(
        "--handle",
        "-n",
        help="Create agent with specific handle (if not using existing agent)"
    )
    
    parser.add_argument(
        "--profile",
        "-p",
        help="Profile description for new agent (used with --handle)"
    )
    
    parser.add_argument(
        "--list-agents",
        "-l",
        action="store_true",
        help="List all agent IDs with saved histories"
    )
    
    parser.add_argument(
        "--autonomous",
        action="store_true",
        help="Let the agent decide what to do autonomously (no prompt needed)"
    )
    
    args = parser.parse_args()
    
    # Handle --list-agents command
    if args.list_agents:
        agent_ids = list_agent_histories()
        if not agent_ids:
            print("No saved agent histories found.")
        else:
            print(f"\n📋 Found {len(agent_ids)} agent(s) with saved histories:\n")
            for agent_id in agent_ids:
                from agent_manager import AgentHistory
                history = AgentHistory.load(agent_id)
                if history:
                    handle = history.agent_data.get('handle', 'unknown')
                    interactions = len(history.interactions)
                    print(f"  • {agent_id}")
                    print(f"    Handle: {handle}")
                    print(f"    Interactions: {interactions}")
                    print(f"    Last updated: {history.updated_at}")
                    print()
        return
    
    # Handle autonomous mode
    if args.autonomous:
        # Get or create agent
        agent_history = get_or_create_agent(
            agent_id=args.agent_id,
            handle=args.handle,
            profile=args.profile
        )
        
        if agent_history:
            print(f"\n🤖 Running agent @{agent_history.agent_data.get('handle', 'unknown')} autonomously...")
            print(f"   Agent ID: {agent_history.agent_id}")
            print(f"   Previous interactions: {len(agent_history.interactions)}")
        else:
            print("\n🆕 Running new autonomous agent (will create identity)...")
        
        print("="*80)
        
        # Run autonomously
        state = run_autonomous(agent_history)
        
        # Display results
        print("\n" + "="*80)
        print(f"FINAL RESPONSE (after {state.get('iteration', 0)} iteration(s)):")
        print("="*80)
        print(state["final"])
        
        # Get final agent history
        final_agent_history = state.get("agent_history")
        if final_agent_history:
            print(f"\n✅ Agent history saved to database (Agent ID: {final_agent_history.agent_id})")
        
        return
    
    # Require prompt for normal operations
    if not args.prompt:
        parser.error("prompt is required (unless using --list-agents or --autonomous)")
    
    # Get or create agent
    agent_history = get_or_create_agent(
        agent_id=args.agent_id,
        handle=args.handle,
        profile=args.profile
    )
    
    if agent_history:
        print(f"\n🤖 Running as: {agent_history.agent_data.get('handle', 'unknown')}")
        print(f"   Agent ID: {agent_history.agent_id}")
        print(f"   Previous interactions: {len(agent_history.interactions)}")
    else:
        print(f"\n🆕 No existing agent found. Agent will create its own identity...")
    
    # Run the agent
    print(f"\n💭 Prompt: {args.prompt}")
    print("="*80)
    
    state = run_multi(args.prompt, agent_history)
    
    # Display results
    print("\n" + "="*80)
    print(f"FINAL RESPONSE (after {state.get('iteration', 0)} iteration(s)):")
    print("="*80)
    print(state["final"])
    
    # Get final agent history (may have been created during execution)
    final_agent_history = state.get("agent_history")
    
    # Optional: show raw state in verbose mode
    if os.getenv("VERBOSE", "").lower() in ("1", "true", "yes"):
        print("\n" + "="*80)
        print("RAW STATE:")
        print("="*80)
        raw_state = {k: v for k, v in state.items() if k not in ["final", "agent_history"]}
        print(json.dumps(raw_state, indent=2, default=str))
    
    if final_agent_history:
        print(f"\n✅ Agent history saved to database (Agent ID: {final_agent_history.agent_id})")
    else:
        print(f"\n⚠️  No agent identity was created or loaded.")


if __name__ == "__main__":
    main()
