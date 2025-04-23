import sys
import os
import webbrowser
import time
from shutil import copyfile

# Import your existing analyzer code
from analyzer import analyze_map, load_map_data
# Import the new export function
from export_map_data import export_map_data_to_json

def run_visualization(map_file_path):
    """
    Process the map data and launch the D3.js visualization.
    
    Parameters:
    map_file_path (str): Path to the Civilization map CSV file
    """
    print(f"Processing map file: {map_file_path}")
    
    try:
        # First load the data to check it
        df = load_map_data(map_file_path)
        
        # Print some debug info
        print(f"Loaded {len(df)} tiles")
        print(f"X coordinate range: {df['X'].min()} to {df['X'].max()}, {df['X'].isna().sum()} NaN values")
        print(f"Y coordinate range: {df['Y'].min()} to {df['Y'].max()}, {df['Y'].isna().sum()} NaN values")
        
        # Analyze the map
        print("Analyzing map data...")
        results = analyze_map(map_file_path)
        
        # Export the processed data to JSON
        print("Exporting data for visualization...")
        json_path = export_map_data_to_json(results, "civ_map_data.json")
        
        # Verify JSON file exists
        if os.path.exists(json_path):
            print(f"✓ Successfully created JSON data at: {json_path}")
            print(f"  File size: {os.path.getsize(json_path) / 1024:.1f} KB")
        else:
            print(f"⚠ ERROR: Failed to create JSON file at: {json_path}")
            return
        
        # Copy the visualization files to the current directory if they don't exist
        ensure_visualization_files()
        
        # Launch the visualization in a web browser
        print(f"Launching D3.js visualization...")
        webbrowser.open(f"http://localhost:8000/civ_map.html")
        
        print("\nVisualization ready!")
        print("If the visualization doesn't open automatically, please go to: http://localhost:8000/civ_map.html")
        
    except Exception as e:
        print(f"Error processing map data: {e}")
        import traceback
        traceback.print_exc()

def ensure_visualization_files():
    """Ensure all required visualization files exist in the current directory."""
    required_files = {
        'civ_map.html': "HTML file for the visualization",
        'civ_map.css': "CSS styles for the visualization",
        'civ_map.js': "JavaScript code for the D3.js visualization"
    }
    
    # Check if each file exists
    missing_files = [f for f in required_files if not os.path.exists(f)]
    
    if missing_files:
        print(f"Missing visualization files: {', '.join(missing_files)}")
        print("Please ensure all visualization files are in the current directory.")
        sys.exit(1)

def check_server_running():
    """Check if a server is running on port 8000, and provide instructions if not."""
    import socket
    
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.connect(('localhost', 8000))
        return True
    except socket.error:
        return False
    finally:
        s.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python run_visualization.py <map_csv_file>")
        sys.exit(1)
    
    map_file = sys.argv[1]
    
    if not os.path.exists(map_file):
        print(f"Error: Map file '{map_file}' not found.")
        sys.exit(1)
    
    # Check if server is running
    if not check_server_running():
        print("\nWARNING: No web server detected on port 8000.")
        print("Please start a web server in this directory using one of these methods:")
        print("\n1. Using Python (recommended):")
        print("   Open a new terminal window and run:")
        print("   python -m http.server")
        print("\n2. Using Node.js (if installed):")
        print("   Open a new terminal window and run:")
        print("   npx http-server")
        
        user_input = input("\nDo you want to start a Python web server now? (y/n): ")
        if user_input.lower() == 'y':
            import subprocess
            import threading
            
            def run_server():
                try:
                    subprocess.run([sys.executable, "-m", "http.server"])
                except KeyboardInterrupt:
                    pass
            
            # Start server in a separate thread
            server_thread = threading.Thread(target=run_server)
            server_thread.daemon = True
            server_thread.start()
            
            # Wait a moment for the server to start
            print("Starting server...")
            time.sleep(2)
        else:
            print("Please start a web server before continuing.")
            sys.exit(1)
    
    # Run the visualization
    run_visualization(map_file)
