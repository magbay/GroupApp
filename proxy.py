from flask import Flask, request, Response, stream_with_context, jsonify
import requests
import threading
import queue
import json

# Import task cache module
try:
    import task_cache
except ImportError:
    task_cache = None
    print("Warning: task_cache module not found, caching disabled")

app = Flask(__name__)

# Default Ollama URL
DEFAULT_OLLAMA_URL = 'http://10.207.20.29:11434/api/generate'

# Simple in-memory SSE broadcaster
clients = []
clients_lock = threading.Lock()

def broadcast(message: str):
    with clients_lock:
        for q in list(clients):
            try:
                q.put(message)
            except Exception:
                # ignore broken clients
                pass


@app.route('/api/generate', methods=['POST', 'OPTIONS'])
def proxy_generate():
    # Handle CORS preflight
    if request.method == 'OPTIONS':
        resp = Response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        # Allow common headers used by the client
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept, X-Ollama-Target'
        return resp

    # Check if custom target URL is provided in headers
    custom_target = request.headers.get('X-Ollama-Target')
    
    if custom_target:
        # Use custom target (e.g., ngrok URL)
        ollama_url = f"{custom_target}/api/generate"
    else:
        # Use default local Ollama
        ollama_url = DEFAULT_OLLAMA_URL

    # Forward POST body and headers to Ollama
    headers = {'Content-Type': 'application/json'}
    try:
        r = requests.post(ollama_url, headers=headers, data=request.get_data(), stream=True, timeout=30)
    except requests.RequestException as e:
        return Response(str(e), status=502)

    # Stream response back to client, preserving ndjson content-type
    def generate():
        try:
            for chunk in r.iter_content(chunk_size=4096):
                if chunk:
                    yield chunk
        finally:
            r.close()

    resp = Response(stream_with_context(generate()), status=r.status_code, content_type=r.headers.get('Content-Type', 'application/x-ndjson'))
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/events', methods=['GET'])
def sse_events():
    # Server-Sent Events endpoint. When a new client connects, notify other clients to reload
    q = queue.Queue()

    with clients_lock:
        # notify existing clients that a new client connected
        broadcast('reload')
        clients.append(q)

    def stream():
        try:
            # Send a comment to keep connection alive initially
            yield ': connected\n\n'
            while True:
                msg = q.get()
                # SSE data frame
                yield f'data: {msg}\n\n'
        finally:
            # Clean up on client disconnect
            with clients_lock:
                if q in clients:
                    clients.remove(q)

    headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    }
    return Response(stream_with_context(stream()), headers=headers)


@app.route('/notify', methods=['POST'])
def notify():
    # Manual trigger to broadcast a message to all connected clients
    msg = request.get_data(as_text=True) or 'reload'
    broadcast(msg)
    return ('', 204)


@app.route('/api/cache/get', methods=['POST', 'OPTIONS'])
def get_cache():
    """Get cached guide for a task."""
    if request.method == 'OPTIONS':
        resp = Response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    
    if not task_cache:
        return jsonify({'error': 'Cache not available'}), 503
    
    data = request.get_json()
    task_name = data.get('task_name')
    task_description = data.get('task_description', '')
    is_advanced = data.get('is_advanced', False)
    model_name = data.get('model_name', 'qwen3:8b')
    
    result = task_cache.get_cached_guide(task_name, task_description, is_advanced, model_name)
    
    resp_data = {}
    if result:
        resp_data = {
            'found': True,
            'guide_content': result[0],
            'created_at': result[1]
        }
    else:
        resp_data = {'found': False}
    
    resp = jsonify(resp_data)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/api/cache/save', methods=['POST', 'OPTIONS'])
def save_cache():
    """Save guide to cache."""
    if request.method == 'OPTIONS':
        resp = Response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    
    if not task_cache:
        return jsonify({'error': 'Cache not available'}), 503
    
    data = request.get_json()
    task_name = data.get('task_name')
    task_description = data.get('task_description', '')
    is_advanced = data.get('is_advanced', False)
    model_name = data.get('model_name', 'qwen3:8b')
    guide_content = data.get('guide_content')
    
    task_cache.save_guide(task_name, task_description, is_advanced, model_name, guide_content)
    
    resp = jsonify({'success': True})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/api/cache/delete', methods=['POST', 'OPTIONS'])
def delete_cache():
    """Delete cached guide (for regeneration)."""
    if request.method == 'OPTIONS':
        resp = Response()
        resp.headers['Access-Control-Allow-Origin'] = '*'
        resp.headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
        resp.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return resp
    
    if not task_cache:
        return jsonify({'error': 'Cache not available'}), 503
    
    data = request.get_json()
    task_name = data.get('task_name')
    task_description = data.get('task_description', '')
    is_advanced = data.get('is_advanced', False)
    model_name = data.get('model_name', 'qwen3:8b')
    
    task_cache.delete_guide(task_name, task_description, is_advanced, model_name)
    
    resp = jsonify({'success': True})
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


@app.route('/api/cache/stats', methods=['GET'])
def cache_stats():
    """Get cache statistics."""
    if not task_cache:
        return jsonify({'error': 'Cache not available'}), 503
    
    stats = task_cache.get_cache_stats()
    resp = jsonify(stats)
    resp.headers['Access-Control-Allow-Origin'] = '*'
    return resp


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001)
