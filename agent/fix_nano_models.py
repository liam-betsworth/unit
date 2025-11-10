#!/usr/bin/env python3
"""
Fix script to update all agents with gpt-4o-nano to gpt-4.1-nano.
gpt-4o-nano was not a valid model option.
"""

import requests
import os

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

def get_all_agents():
    """Fetch all agents from the API."""
    response = requests.get(f"{BACKEND_URL}/agents")
    response.raise_for_status()
    return response.json()

def update_agent_model(agent_id: str, new_model: str):
    """Update an agent's model via PATCH request."""
    response = requests.patch(
        f"{BACKEND_URL}/agents/{agent_id}",
        json={"llmModel": new_model}
    )
    response.raise_for_status()
    return response.json()

def main():
    print("🔧 Fixing gpt-4o-nano → gpt-4.1-nano for all agents...")
    print("=" * 80)
    
    # Get all agents
    agents = get_all_agents()
    print(f"\n📊 Found {len(agents)} agents in database\n")
    
    # Find agents with gpt-4o-nano
    agents_to_fix = [a for a in agents if a.get('llmModel') == 'gpt-4o-nano']
    
    if not agents_to_fix:
        print("✅ No agents with gpt-4o-nano found. Nothing to fix!")
        return
    
    print(f"🔄 {len(agents_to_fix)} agents need to be updated:\n")
    
    # Update each agent
    for i, agent in enumerate(agents_to_fix, 1):
        handle = agent['handle']
        agent_id = agent['id']
        print(f"[{i}/{len(agents_to_fix)}] @{handle}")
        print(f"   🔄 Updating: gpt-4o-nano → gpt-4.1-nano... ", end="")
        
        try:
            update_agent_model(agent_id, "gpt-4.1-nano")
            print("✓")
        except Exception as e:
            print(f"✗ Error: {e}")
    
    print("\n" + "=" * 80)
    
    # Verify the fix
    agents_after = get_all_agents()
    remaining = [a for a in agents_after if a.get('llmModel') == 'gpt-4o-nano']
    
    if remaining:
        print(f"⚠️  WARNING: {len(remaining)} agents still have gpt-4o-nano")
    else:
        print(f"🎉 Fix complete! All agents updated successfully.")
    
    # Show final distribution
    print("\n📊 Final Model Distribution:")
    model_counts = {}
    for agent in agents_after:
        model = agent.get('llmModel', 'NO MODEL')
        model_counts[model] = model_counts.get(model, 0) + 1
    
    for model, count in sorted(model_counts.items(), key=lambda x: -x[1]):
        percentage = (count / len(agents_after)) * 100
        print(f"   {model:20s}: {count:2d} agents ({percentage:.0f}%)")

if __name__ == "__main__":
    main()
