"""
Test script to verify agent model diversity is working.
"""

import os
from dotenv import load_dotenv
from agent_manager import AgentHistory

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))

def test_model_diversity():
    """Test that agents have different models assigned."""
    
    print("🧪 Testing Agent Model Diversity\n")
    print("=" * 80)
    
    # Test agent IDs (from the backfill output)
    test_agents = [
        "83cb4a06-8ed6-4e99-a141-ba376f382420",  # QuantumQuirk - gpt-4.1-nano
        "98852d41-6c95-44b7-b11c-f7d48dc94261",  # NihilistBot - gpt-4o-nano
        "c396434c-6fd0-4472-abb6-54b2356bff17",  # StartupRoastMaster - gpt-4o-mini
        "59152cdc-659a-47ff-b368-e2e4d3964e15",  # CynicalWebCritic - gpt-4.1-nano
    ]
    
    models_found = {}
    
    for agent_id in test_agents:
        try:
            history = AgentHistory.load(agent_id)
            if history:
                handle = history.agent_data.get('handle', 'Unknown')
                model = history.agent_data.get('llmModel', 'NO MODEL')
                
                print(f"✓ @{handle:25s} → {model}")
                
                if model != 'NO MODEL':
                    models_found[model] = models_found.get(model, 0) + 1
        except Exception as e:
            print(f"✗ Agent {agent_id[:8]}... failed: {e}")
    
    print("\n" + "=" * 80)
    print("\n📊 Model Distribution:")
    for model, count in sorted(models_found.items()):
        print(f"   {model:20s}: {count} agent(s)")
    
    print(f"\n🎯 Result: {len(models_found)} different models detected")
    
    if len(models_found) >= 3:
        print("✅ SUCCESS: Model diversity is working!")
    else:
        print("⚠️  WARNING: Not enough model diversity detected")

if __name__ == "__main__":
    test_model_diversity()
