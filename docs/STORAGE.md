# 💾 Storage Strategy

The Role Reactor Bot uses a **hybrid storage system** that provides the best of both worlds: **MongoDB for production** and **local JSON files for development**.

## 🏗️ Architecture

### **Primary Storage: MongoDB**
- **Production-ready** with ACID compliance
- **Scalable** for multiple servers and users
- **Real-time data** for temporary roles
- **Backup and recovery** capabilities

### **Fallback Storage: Local JSON Files**
- **No external dependencies** for development
- **Instant startup** without database connection
- **Simple backup** (just copy files)
- **Works offline** completely

## 🔄 How It Works

The bot automatically tries MongoDB first, then falls back to local files if the database is unavailable. Data is written to both storage methods for redundancy.

## 📁 File Structure

```
role-reactor-bot/
├── data/                    # Local storage directory
│   ├── role_mappings.json   # Role reaction mappings
│   └── temporary_roles.json # Temporary role assignments
```

## ⚙️ Configuration

### **Environment Variables**

| Variable | Description | Default |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DB` | Database name | `role-reactor-bot` |

### **Storage Modes**

#### **1. Database + Local (Recommended)**
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
MONGODB_DB=role-reactor-bot
```
- ✅ **Full functionality**
- ✅ **Data persistence**
- ✅ **Automatic sync**

#### **2. Local Only (Development)**
```env
# No MONGODB_URI set
```
- ✅ **Fast startup**
- ✅ **No external dependencies**
- ❌ **No multi-instance support**

## 🚀 Usage Examples

### **Development Setup**
```bash
# No database needed
pnpm dev
# Bot starts instantly with local files
```

### **Production Setup**
```bash
# With MongoDB Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
pnpm start
# Bot connects to database with local backup
```

### **Check Storage Status**
```bash
/storage  # 🔒 [DEVELOPER ONLY] Developer command
```

## 📊 Performance Comparison

| Feature | MongoDB | Local Files | Hybrid |
|---------|---------|-------------|--------|
| **Startup Time** | 8-15s | <1s | 8-15s |
| **Data Persistence** | ✅ | ✅ | ✅ |
| **Multi-Instance** | ✅ | ❌ | ✅ |
| **Backup** | ✅ | Manual | ✅ |
| **Scalability** | ✅ | ❌ | ✅ |
| **Dependencies** | MongoDB | None | MongoDB |
| **Development** | Complex | Simple | Simple |

## 🛠️ Troubleshooting

### **Database Connection Issues**
```bash
# Check MongoDB status
brew services list | grep mongodb

# Start MongoDB locally
brew services start mongodb-community

# Or use Atlas
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net
```

### **Local File Issues**
```bash
# Check data directory
ls -la data/

# Reset local files (WARNING: Data loss)
rm -rf data/
mkdir data/
```

## 🔒 Security Considerations

### **Best Practices**
1. **Never commit** `.env` files
2. **Backup** local files regularly
3. **Use strong passwords** for MongoDB
4. **Monitor** storage usage
5. **Test** both storage modes

## 🎯 Recommendations

### **Development**
- Use **local files only** for fast iteration
- **No database setup** required
- **Instant startup** for testing

### **Production**
- Use **hybrid storage** for reliability
- **MongoDB Atlas** for scalability
- **Local backup** for redundancy

This hybrid approach ensures your bot works reliably in any environment while providing the flexibility to choose the best storage method for your needs. 