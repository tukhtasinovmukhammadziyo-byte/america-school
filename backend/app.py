import os
import json
import sqlite3
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from database import get_db_connection, init_db

# Initialize Flask App
app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = 'american-school-secret-2024'
app.config['UPLOAD_FOLDER'] = 'uploads'
CORS(app)
jwt = JWTManager(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize Database on Startup
init_db()

# Ensure Uploads exist
if not os.path.exists(app.config['UPLOAD_FOLDER']):
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Auth Endpoints
@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM users WHERE username = ? AND password = ?',
                        (data.get('username'), data.get('password'))).fetchone()
    conn.close()
    
    if user:
        u_dict = dict(user)
        token = create_access_token(identity=u_dict['username'])
        return jsonify({"access_token": token, "user": u_dict})
    return jsonify({"msg": "Login yoki parol xato!"}), 401

@app.route('/api/auth/register', methods=['POST'])
def signup():
    data = request.json
    conn = get_db_connection()
    try:
        conn.execute('INSERT INTO users (username, password, name, phone, course) VALUES (?, ?, ?, ?, ?)',
                     (data['username'], data.get('password', '123'), data['name'], data['phone'], data.get('course', '')))
        conn.commit()
        conn.close()
        return jsonify({"msg": "Muvaffaqiyatli ro'yxatdan o'tdingiz!"})
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"msg": "Bu raqam band!"}), 400

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    users = conn.execute('SELECT username, name, role, phone, course, attendance, ielts, teacher FROM users').fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])

@app.route('/api/users/<username>', methods=['GET'])
def get_user_profile(username):
    conn = get_db_connection()
    user = conn.execute('SELECT username, name, role, phone, course, attendance, ielts, teacher FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    if user:
        return jsonify(dict(user))
    return jsonify({"msg": "Foydalanuvchi topilmadi!"}), 404

@app.route('/api/users/update', methods=['POST'])
def update_user():
    data = request.json
    username = data.get('username')
    name = data.get('name')
    course = data.get('course', '')
    attendance = data.get('attendance', 0)
    ielts = data.get('ielts', '0')
    teacher = data.get('teacher', 'Yo\'q')
    
    if not username:
        return jsonify({"msg": "Username talab qilinadi!"}), 400
        
    conn = get_db_connection()
    try:
        conn.execute('''
            UPDATE users 
            SET name = ?, course = ?, attendance = ?, ielts = ?, teacher = ? 
            WHERE username = ?
        ''', (name, course, attendance, ielts, teacher, username))
        conn.commit()
        conn.close()
        return jsonify({"msg": "O'quvchi ma'lumotlari muvaffaqiyatli yangilandi!"})
    except Exception as e:
        conn.close()
        return jsonify({"msg": "Xatolik yuz berdi!", "detail": str(e)}), 500

@app.route('/api/users/delete/<username>', methods=['DELETE', 'POST'])
def delete_user(username):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM users WHERE username = ?', (username,))
        conn.commit()
        conn.close()
        return jsonify({"msg": "O'quvchi o'chirildi!"})
    except Exception as e:
        conn.close()
        return jsonify({"msg": "Xatolik yuz berdi!", "detail": str(e)}), 500

# Settings Endpoints
@app.route('/api/settings', methods=['GET'])
def get_settings():
    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM settings').fetchall()
    conn.close()
    return jsonify({row['key']: row['value'] for row in rows})

@app.route('/api/settings', methods=['POST'])
def save_settings():
    data = request.json
    conn = get_db_connection()
    for key, value in data.items():
        conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    conn.commit()
    conn.close()
    return jsonify({"msg": "Saqlandi!"})

# File Upload
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return 'Fayl yo\'q', 400
    file = request.files['file']
    filename = datetime.now().strftime("%Y%m%d%H%M%S") + "_" + file.filename
    file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    return jsonify({"url": f"/uploads/{filename}"})

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# Chat Events
@socketio.on('identify')
def on_identify(data):
    username = data.get('username')
    if username: join_room(username)

@socketio.on('send_private_message')
def handle_private_message(data):
    conn = get_db_connection()
    room = get_room_name(data['sender'], data['receiver'])
    msg = {
        "room": room,
        "sender": data['sender'],
        "receiver": data['receiver'],
        "text": data['text'],
        "timestamp": datetime.now().strftime("%H:%M")
    }
    conn.execute('INSERT INTO messages (room, sender, receiver, text, timestamp) VALUES (?, ?, ?, ?, ?)',
                 (room, msg['sender'], msg['receiver'], msg['text'], msg['timestamp']))
    conn.commit()
    conn.close()
    
    emit('receive_private_message', msg, room=data['sender'])
    emit('receive_private_message', msg, room=data['receiver'])

def get_room_name(u1, u2):
    return f"private_{min(str(u1), str(u2))}_{max(str(u1), str(u2))}"

@app.route('/api/chat/history', methods=['GET'])
def get_all_history():
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM messages ORDER BY id DESC LIMIT 50').fetchall()
    conn.close()
    return jsonify([{"user": m["sender"], "text": m["text"], "timestamp": m["timestamp"]} for m in messages])

@app.route('/api/chat/history/<u1>/<u2>', methods=['GET'])
def get_private_history(u1, u2):
    room = get_room_name(u1, u2)
    conn = get_db_connection()
    messages = conn.execute('SELECT * FROM messages WHERE room = ?', (room,)).fetchall()
    conn.close()
    return jsonify([dict(m) for m in messages])

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=True, host='0.0.0.0', port=port)
