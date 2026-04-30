import os
import glob
import re

for filepath in glob.glob('frontend/src/**/*.jsx', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace anything like: const API_CITAS = 'http://localhost:8001'
    # with: const API_CITAS = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE + '/citas' : 'http://localhost:8001'
    # Wait, the port numbers dictate the path?
    # 8001 -> /citas
    # 8002 -> /expedientes
    # 8003 -> /quirofanos
    # 8004 -> /insumos
    # 8005 -> /personal
    # 8006 -> /sql
    
    replacements = {
        '8001': '/citas',
        '8002': '/expedientes',
        '8003': '/quirofanos',
        '8004': '/insumos',
        '8005': '/personal',
        '8006': '/sql'
    }
    
    def replacer(match):
        var_name = match.group(1)
        port = match.group(2)
        path = replacements.get(port, '')
        return f"const API_{var_name} = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE : 'http://localhost:{port}'"

    new_content = re.sub(r"const API_([A-Z_]+)\s*=\s*['\"`]http://localhost:(\d+)['\"`]", replacer, content)
    
    # Actually wait. If I just do VITE_API_BASE, does the code append `/citas`?
    # In CitasAdmin.jsx: fetch(`${API_CITAS}/citas`)
    # If API_CITAS = 'http://VPC01_IP', then it will request http://VPC01_IP/citas.
    # So yes! We just need to replace the localhost string with the env variable.
    
    if content != new_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
