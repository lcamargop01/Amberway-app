#!/usr/bin/env python3
"""
Import multiple SQL chunk files to Cloudflare D1 using bulk import API.
"""

import os
import json
import hashlib
import time
import glob
import urllib.request
import urllib.error

CF_TOKEN = os.environ.get('CLOUDFLARE_API_TOKEN', '')
ACCOUNT_ID = '1243bbec4c5f123d4b0892705cee700c'
DB_ID = '48e29101-241e-41cc-a843-73c7e99cf93c'
D1_URL = f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/import'

HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {CF_TOKEN}',
}

def post_json(url, payload, timeout=60):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, method='POST', headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read()), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode()

def put_raw(url, data_bytes, timeout=120):
    req = urllib.request.Request(url, data=data_bytes, method='PUT', headers={
        'Content-Type': 'text/plain'
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.headers.get('ETag', '').strip('"'), None
    except urllib.error.HTTPError as e:
        return None, e.read().decode()

def poll_import(bookmark, chunk_name):
    for attempt in range(30):
        result, err = post_json(D1_URL, {
            'action': 'poll',
            'current_bookmark': bookmark
        })
        if err:
            time.sleep(2)
            continue
        
        r = result.get('result', {})
        success = r.get('success')
        error = r.get('error', '')
        status = r.get('status', '')
        
        if success:
            msgs = r.get('messages', [])
            print(f"    ✅ Done: {msgs}")
            return True
        
        if 'Not currently importing' in error:
            print(f"    ✅ Completed (no active import)")
            return True
        
        if 'error' in r and r['error'] and 'Not currently' not in r['error']:
            print(f"    ❌ Error: {r['error']}")
            return False
        
        time.sleep(1.5)
    
    return False

def import_file(chunk_file):
    with open(chunk_file, 'rb') as f:
        sql_bytes = f.read()
    
    etag = hashlib.md5(sql_bytes).hexdigest()
    
    # Step 1: Init
    result, err = post_json(D1_URL, {'action': 'init', 'etag': etag})
    if err or not result or not result.get('success'):
        print(f"    Init failed: {err or result}")
        return False
    
    upload_url = result['result']['upload_url']
    filename = result['result']['filename']
    
    # Step 2: Upload
    r2_etag, err = put_raw(upload_url, sql_bytes)
    if err:
        print(f"    Upload failed: {err[:200]}")
        return False
    
    # Step 3: Ingest
    result, err = post_json(D1_URL, {
        'action': 'ingest',
        'etag': etag,
        'filename': filename
    })
    if err or not result:
        print(f"    Ingest failed: {err[:200] if err else result}")
        return False
    
    r = result.get('result', {})
    if r.get('error') and 'SQLITE_TOOBIG' in r.get('error', ''):
        print(f"    ❌ Statement too big!")
        return False
    
    if not result.get('success'):
        print(f"    Ingest error: {result}")
        return False
    
    bookmark = r.get('at_bookmark')
    
    # Step 4: Poll
    return poll_import(bookmark, chunk_file)

def main():
    # Get chunk files sorted
    chunk_files = sorted(glob.glob('/home/user/webapp/import_chunk_*.sql'))
    print(f"Found {len(chunk_files)} chunk files to import")
    
    # Check current state
    result, _ = post_json(
        f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query',
        {'sql': 'SELECT COUNT(*) as cnt FROM contacts'}
    )
    if result and result.get('success'):
        cnt = result['result'][0]['results'][0].get('cnt', 0)
        print(f"Current production contacts: {cnt}")
    
    success_files = 0
    failed_files = 0
    
    for i, chunk_file in enumerate(chunk_files):
        fname = os.path.basename(chunk_file)
        size = os.path.getsize(chunk_file)
        print(f"\n[{i+1}/{len(chunk_files)}] {fname} ({size} bytes)...")
        
        ok = import_file(chunk_file)
        if ok:
            success_files += 1
            print(f"    OK")
        else:
            failed_files += 1
            print(f"    FAILED - will retry...")
            # Retry once
            time.sleep(3)
            ok2 = import_file(chunk_file)
            if ok2:
                success_files += 1
                failed_files -= 1
                print(f"    Retry OK")
        
        # Small delay between chunks
        time.sleep(1)
    
    print(f"\n{'='*50}")
    print(f"Import complete: {success_files} ok, {failed_files} failed")
    
    # Final counts
    time.sleep(3)
    result, _ = post_json(
        f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DB_ID}/query',
        {'sql': 'SELECT (SELECT COUNT(*) FROM contacts) as c, (SELECT COUNT(*) FROM deals) as d, (SELECT COUNT(*) FROM communications) as comms'}
    )
    if result and result.get('success'):
        row = result['result'][0]['results'][0]
        print(f"\n🎉 Production DB final counts:")
        print(f"   Contacts:       {row.get('c', '?')}")
        print(f"   Deals:          {row.get('d', '?')}")
        print(f"   Communications: {row.get('comms', '?')}")

if __name__ == '__main__':
    main()
