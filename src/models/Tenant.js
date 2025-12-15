// src/models/Tenant.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const TenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    brandName: {
      type: String,
      required: true,
    },
    settings: {
      ragLimits: {
        maxTokens: Number,
        documentPriority: Number,
      },
      rateLimits: {
        ragPerMinute: Number,
        uploadPerMinute: Number,
        processPerMinute: Number,
      },
      maxUsers: Number,
      maxPdfs: Number,
      llmModel: String,
    },
  },
  {
    timestamps: true,
  }
);

// Índice extra por slug (aunque ya hay unique)
TenantSchema.index({ slug: 1 });

export const TenantModel = model('Tenant', TenantSchema);

