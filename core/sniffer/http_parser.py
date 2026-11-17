"""
Layer 7 HTTP (RFC 2616 / 7230) Dissector.
Built from scratch without external libraries.
"""

HTTP_METHODS = {"GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH", "CONNECT", "TRACE"}

def dissect_http(payload: bytes) -> dict | None:
    if len(payload) < 4:
        return None

    try:
        header_text = payload.decode("latin-1")
    except Exception:
        return None

    lines = header_text.split("\r\n")
    if not lines or not lines[0]:
        return None

    first_line = lines[0].strip()
    parts = first_line.split(" ")

    is_request = False
    is_response = False
    method = None
    uri = None
    version = None
    status_code = None
    reason = None

    if len(parts) >= 3 and parts[0] in HTTP_METHODS and parts[2].startswith("HTTP/"):
        is_request = True
        method = parts[0]
        uri = parts[1]
        version = parts[2]
        info = f"{method} {uri} {version}"
    elif len(parts) >= 2 and parts[0].startswith("HTTP/"):
        is_response = True
        version = parts[0]
        status_code = parts[1]
        reason = " ".join(parts[2:]) if len(parts) > 2 else ""
        info = f"{version} {status_code} {reason}"
    else:
        return None  # Not an HTTP header line

    headers = {}
    i = 1
    while i < len(lines):
        line = lines[i]
        if not line:  # blank line indicates end of headers
            break
        if ":" in line:
            h_name, h_val = line.split(":", 1)
            headers[h_name.strip()] = h_val.strip()
        i += 1

    fields = [first_line]
    for h_name, h_val in headers.items():
        fields.append(f"{h_name}: {h_val}")

    tree = {
        "title": f"Hypertext Transfer Protocol ({'Request' if is_request else 'Response'})",
        "fields": fields
    }

    return {
        "is_request": is_request,
        "is_response": is_response,
        "method": method,
        "uri": uri,
        "version": version,
        "status_code": status_code,
        "reason": reason,
        "headers": headers,
        "info": info,
        "tree": tree
    }
