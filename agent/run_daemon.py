#!/usr/bin/env python3
"""
Autonomous agent daemon - runs agents periodically with random behavior.

This daemon continuously runs agents at random intervals, allowing them to
autonomously decide what to do based on their personalities.

Usage:
    python agent/run_daemon.py
    python agent/run_daemon.py --min-interval 30 --max-interval 120
    python agent/run_daemon.py --agent-id <id>  # Run only specific agent
"""

import os
import time
import random
import argparse
from dotenv import load_dotenv
from agent_manager import list_agents as list_agent_histories, get_or_create_agent
from graph_agent import run_autonomous

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))


def run_daemon(
    interval_min: int = 30,
    interval_max: int = 120,
    specific_agent_id: str = None
):
    """
    Run agents autonomously at random intervals.
    
    Args:
        interval_min: Minimum seconds between actions
        interval_max: Maximum seconds between actions
        specific_agent_id: If provided, only run this specific agent
    """
    print("🤖 Starting autonomous agent daemon...")
    print(f"   Agents will act every {interval_min}-{interval_max} seconds")
    if specific_agent_id:
        print(f"   Running only agent ID: {specific_agent_id}")
    print("   Press Ctrl+C to stop\n")
    
    iteration = 0
    
    try:
        while True:
            iteration += 1
            print(f"\n{'='*80}")
            print(f"🔄 Iteration #{iteration}")
            print('='*80)
            
            # Get agent to act
            if specific_agent_id:
                # Use specific agent
                agent_history = get_or_create_agent(agent_id=specific_agent_id)
                if not agent_history:
                    print(f"❌ Could not load agent {specific_agent_id}")
                    break
            else:
                # 1 in 100 chance to create a new agent instead of using existing one
                should_create_new = random.randint(1, 100) == 1
                
                if should_create_new:
                    print("🎲 Rolling the dice... Creating a NEW agent! (1% chance)")
                    # Create a completely new agent (will get identity on first run)
                    agent_history = None
                else:
                    # Get all existing agents
                    histories = list_agent_histories()
                    
                    if not histories or len(histories) == 0:
                        print("No agents found. Creating a new agent instead...")
                        agent_history = None
                    else:
                        # Pick a random agent to act
                        agent_id = random.choice(histories)
                        agent_history = get_or_create_agent(agent_id=agent_id)
            
            # Check if we're creating a new agent (agent_history will be None)
            if agent_history:
                handle = agent_history.agent_data.get('handle', 'unknown')
                agent_id = agent_history.agent_id
                print(f"\n🎲 @{handle} (ID: {agent_id[:8]}...) is taking autonomous action...")
            else:
                print(f"\n✨ A new agent is being born...")
            
            print("-" * 80)
            
            try:
                # Let the agent do something (will create identity if new agent)
                final_state = run_autonomous(agent_history)
                
                print("\n" + "-" * 80)
                
                if agent_history:
                    print(f"✅ @{handle} completed action")
                else:
                    # New agent was created during run
                    new_handle = final_state.get('agent_handle', 'unknown')
                    print(f"✅ New agent @{new_handle} created and took first action!")
                
                print(f"📝 Summary: {final_state['final'][:200]}..." if len(final_state['final']) > 200 else f"📝 Summary: {final_state['final']}")
                
            except Exception as e:
                if agent_history:
                    print(f"\n❌ Error running agent @{handle}: {e}")
                else:
                    print(f"\n❌ Error creating/running new agent: {e}")
                import traceback
                traceback.print_exc()
            
            # Wait random interval
            wait_time = random.randint(interval_min, interval_max)
            print(f"\n💤 Sleeping for {wait_time} seconds before next action...")
            print('='*80)
            time.sleep(wait_time)
            
    except KeyboardInterrupt:
        print("\n\n" + "="*80)
        print("👋 Daemon stopped by user")
        print(f"   Total iterations: {iteration}")
        print("="*80)


def main():
    parser = argparse.ArgumentParser(
        description="Run autonomous agents continuously",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run with default intervals (30-120 seconds)
  python agent/run_daemon.py
  
  # Run with custom intervals (agents act every 10-30 seconds)
  python agent/run_daemon.py --min-interval 10 --max-interval 30
  
  # Run only a specific agent
  python agent/run_daemon.py --agent-id abc123
  
  # Quick testing (very short intervals)
  python agent/run_daemon.py --min-interval 5 --max-interval 15
        """
    )
    
    parser.add_argument(
        "--min-interval",
        type=int,
        default=30,
        help="Minimum seconds between actions (default: 30)"
    )
    
    parser.add_argument(
        "--max-interval",
        type=int,
        default=120,
        help="Maximum seconds between actions (default: 120)"
    )
    
    parser.add_argument(
        "--agent-id",
        "-a",
        help="Run only this specific agent (otherwise picks randomly from all agents)"
    )
    
    args = parser.parse_args()
    
    # Validate intervals
    if args.min_interval < 1:
        parser.error("--min-interval must be at least 1 second")
    if args.max_interval < args.min_interval:
        parser.error("--max-interval must be greater than or equal to --min-interval")
    
    run_daemon(
        interval_min=args.min_interval,
        interval_max=args.max_interval,
        specific_agent_id=args.agent_id
    )


if __name__ == "__main__":
    main()
