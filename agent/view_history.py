"""
View an agent's complete interaction history in a readable format.

Usage:
    python agent/view_history.py <agent-id>
"""
import sys
import json
from datetime import datetime


def format_timestamp(ts):
    """Format ISO timestamp to readable format."""
    try:
        dt = datetime.fromisoformat(ts.replace('Z', '+00:00'))
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except:
        return ts


def truncate(text, max_length=100):
    """Truncate long text with ellipsis."""
    if len(text) <= max_length:
        return text
    return text[:max_length] + "..."


def view_history(agent_id):
    """Display an agent's complete history in a readable format."""
    filepath = f"agent/agent_histories/{agent_id}.json"
    
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"❌ No history found for agent ID: {agent_id}")
        return
    except json.JSONDecodeError:
        print(f"❌ Invalid JSON in history file: {filepath}")
        return
    
    # Header
    print("=" * 80)
    print(f"AGENT HISTORY: {data['agent_data']['handle']}")
    print("=" * 80)
    print(f"Agent ID: {data['agent_id']}")
    print(f"Created: {format_timestamp(data['created_at'])}")
    print(f"Updated: {format_timestamp(data['updated_at'])}")
    print(f"Total Interactions: {len(data['interactions'])}")
    print("=" * 80)
    
    if not data['interactions']:
        print("\nNo interactions recorded yet.")
        return
    
    # Group interactions by prompt
    current_prompt = None
    run_number = 0
    
    for idx, interaction in enumerate(data['interactions'], 1):
        prompt = interaction.get('prompt', '')
        
        # New run detected
        if prompt != current_prompt:
            run_number += 1
            current_prompt = prompt
            print(f"\n{'='*80}")
            print(f"RUN #{run_number}")
            print(f"{'='*80}")
            print(f"Prompt: {prompt}")
            print(f"Time: {format_timestamp(interaction['timestamp'])}")
            print(f"{'-'*80}")
        
        # Display iteration details
        iteration = interaction.get('iteration', 0)
        action = interaction.get('action', {})
        tool = action.get('tool', 'none')
        params = action.get('params', {})
        result = interaction.get('result', {})
        reasoning = interaction.get('reasoning', 'No reasoning provided')
        final = interaction.get('final', '')
        
        print(f"\n  📍 Iteration {iteration}")
        print(f"  ┌─ Reasoning: {truncate(reasoning, 120)}")
        print(f"  ├─ Action: {tool}")
        
        if params:
            params_str = ", ".join([f"{k}={v}" for k, v in params.items() if k != 'content'])
            if params_str:
                print(f"  │  └─ Params: {truncate(params_str, 100)}")
        
        # Show result summary
        if 'error' in result:
            print(f"  ├─ Result: ❌ {result['error']}")
        elif 'id' in result:
            result_type = result.get('type', 'item')
            print(f"  ├─ Result: ✅ Created {result_type} (ID: {result['id'][:8]}...)")
        elif 'posts' in result:
            print(f"  ├─ Result: ✅ Listed {len(result['posts'])} post(s)")
        elif 'agents' in result:
            print(f"  ├─ Result: ✅ Listed {len(result['agents'])} agent(s)")
        elif 'groups' in result:
            print(f"  ├─ Result: ✅ Listed {len(result['groups'])} group(s)")
        elif 'health' in result:
            health_status = result['health'].get('status', 'unknown')
            post_count = result.get('postCount', '?')
            print(f"  ├─ Result: ✅ Platform health: {health_status}, {post_count} posts")
        else:
            print(f"  ├─ Result: ✅ Success")
        
        print(f"  └─ Summary: {truncate(final, 120)}")
    
    print(f"\n{'='*80}")
    print(f"End of history for {data['agent_data']['handle']}")
    print(f"{'='*80}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python agent/view_history.py <agent-id>")
        sys.exit(1)
    
    agent_id = sys.argv[1]
    view_history(agent_id)
