"""
Backfill script to assign LLM models to all existing agents.
"""

import os
import requests
import random
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

# Available models for agents
# Note: gpt-4o-nano is not a valid model, removed from list
AVAILABLE_MODELS = [
    "gpt-4o-mini",      # Fast, cheap, good for most tasks
    "gpt-4.1-nano",     # Nano model option
    "gpt-5-mini",       # Newer generation, more capable
    "gpt-5-nano",       # Newest nano model
]

def update_agent_model(agent_id: str, model: str):
    """Update an agent's LLM model."""
    try:
        response = requests.patch(
            f"{BACKEND_URL}/agents/{agent_id}",
            json={"llmModel": model}
        )
        if response.ok:
            return True
        else:
            print(f"  ⚠️  Failed to update: {response.status_code} {response.text}")
            return False
    except Exception as e:
        print(f"  ⚠️  Error updating agent: {e}")
        return False

def main():
    print("🎲 Backfilling LLM models for all agents...")
    print("=" * 80)
    print(f"\nAvailable models: {', '.join(AVAILABLE_MODELS)}\n")
    
    # Get all agents
    response = requests.get(f"{BACKEND_URL}/agents")
    if not response.ok:
        print("❌ Failed to fetch agents")
        return
    
    all_agents = response.json()
    print(f"📊 Found {len(all_agents)} agents in database\n")
    
    # Filter agents that need model assignment
    agents_to_update = [a for a in all_agents if not a.get('llmModel')]
    
    print(f"   ✅ {len(all_agents) - len(agents_to_update)} agents already have models")
    print(f"   🔄 {len(agents_to_update)} agents need model assignment\n")
    
    if not agents_to_update:
        print("🎉 All agents already have model assignments!")
        return
    
    # Track assignments
    updated_count = 0
    failed = []
    model_distribution = {model: 0 for model in AVAILABLE_MODELS}
    
    for i, agent in enumerate(agents_to_update, 1):
        agent_id = agent['id']
        handle = agent['handle']
        
        # Randomly select a model
        selected_model = random.choice(AVAILABLE_MODELS)
        
        print(f"[{i}/{len(agents_to_update)}] @{handle}")
        print(f"   🎲 Assigning model: {selected_model}... ", end='', flush=True)
        
        if update_agent_model(agent_id, selected_model):
            print(f"✓")
            updated_count += 1
            model_distribution[selected_model] += 1
        else:
            print(f"✗")
            failed.append(handle)
    
    print("\n" + "=" * 80)
    print(f"\n🎉 Backfill complete!")
    print(f"   ✅ Successfully updated: {updated_count} agents")
    if failed:
        print(f"   ❌ Failed: {len(failed)} agents ({', '.join(failed)})")
    
    print(f"\n📊 Model Distribution:")
    for model, count in sorted(model_distribution.items(), key=lambda x: x[1], reverse=True):
        if count > 0:
            percentage = (count / updated_count * 100) if updated_count > 0 else 0
            print(f"   {model:20s}: {count:2d} agents ({percentage:.0f}%)")

if __name__ == "__main__":
    main()
