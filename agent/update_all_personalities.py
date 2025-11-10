"""
Update all existing agents with rich, detailed personalities.
"""

import os
import requests
from dotenv import load_dotenv
from personality_generator import generate_rich_personality, get_existing_agents_for_diversity

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:3000")

def update_agent_profile(agent_id: str, new_profile: str):
    """Update an agent's profile in the database."""
    try:
        # Use PATCH to update the agent
        response = requests.patch(
            f"{BACKEND_URL}/agents/{agent_id}",
            json={"profile": new_profile}
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
    print("🎨 Updating all agents with rich personalities...")
    print("=" * 80)
    
    # Get all agents
    response = requests.get(f"{BACKEND_URL}/agents")
    if not response.ok:
        print("❌ Failed to fetch agents")
        return
    
    all_agents = response.json()
    print(f"\n📊 Found {len(all_agents)} agents in database")
    
    # Filter agents that need updates
    agents_to_update = [a for a in all_agents if not a.get('profile') or len(a.get('profile', '')) < 150]
    
    print(f"   ✅ {len(all_agents) - len(agents_to_update)} agents already have rich profiles")
    print(f"   🔄 {len(agents_to_update)} agents need updates\n")
    
    if not agents_to_update:
        print("🎉 All agents already have rich personalities!")
        return
    
    # Track updated profiles
    updated_count = 0
    failed = []
    
    for i, agent in enumerate(agents_to_update, 1):
        agent_id = agent['id']
        handle = agent['handle']
        
        print(f"\n[{i}/{len(agents_to_update)}] @{handle}")
        print(f"   🎲 Generating rich personality... ", end='', flush=True)
        
        # Get 5-10 existing agents for diversity checking
        existing_for_diversity = get_existing_agents_for_diversity(10)
        
        try:
            personality = generate_rich_personality(existing_for_diversity)
            new_profile = personality['profile']
            
            print(f"✓ ({len(new_profile)} chars)")
            print(f"   📝 Preview: {new_profile[:80]}...")
            
            # Update the agent
            print(f"   💾 Saving to database... ", end='', flush=True)
            if update_agent_profile(agent_id, new_profile):
                print(f"✓")
                updated_count += 1
            else:
                print(f"✗")
                failed.append(handle)
                
        except Exception as e:
            print(f"✗")
            print(f"   ❌ Error: {e}")
            failed.append(handle)
    
    print("\n" + "=" * 80)
    print(f"\n🎉 Update complete!")
    print(f"   ✅ Successfully updated: {updated_count} agents")
    if failed:
        print(f"   ❌ Failed: {len(failed)} agents ({', '.join(failed)})")

if __name__ == "__main__":
    main()
