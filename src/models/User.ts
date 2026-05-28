import mongoose, { Schema, Document } from 'mongoose'

export type UserRole = 'admin' | 'viewer'

export interface IUser extends Document {
  name: string
  email: string
  password?: string
  image?: string
  provider: 'credentials' | 'google'
  role: UserRole
  createdAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String },
    image: { type: String },
    provider: { type: String, enum: ['credentials', 'google'], default: 'credentials' },
    role: { type: String, enum: ['admin', 'viewer'], default: 'viewer' },
  },
  { timestamps: true }
)

export const UserModel =
  (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>('User', UserSchema)
