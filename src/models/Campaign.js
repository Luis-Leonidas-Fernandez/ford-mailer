// src/models/Campaign.js
import mongoose from 'mongoose';

const { Schema, model } = mongoose;

const CampaignSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    segmentId: {
      type: Schema.Types.ObjectId,
      required: true, // viene de vector-rag
    },

    nombreCampaña: {
      type: String,
      required: true,
    },

    canales: [
      {
        type: String, // p.ej. ['email']
      },
    ],

    plantillaEmail: {
      templateId: {
        type: String,
      },
      asunto: {
        type: String,
      },
      imagenPromoUrl: {
        type: String,
      },
    },

    plantillaWhatsApp: {
      templateName: {
        type: String,
      },
      languageCode: {
        type: String,
        default: 'es_AR',
      },
    },

    metrics: {
      whatsapp: {
        encolados: { type: Number, default: 0 },
        omitidos: { type: Number, default: 0 },
        enviados: { type: Number, default: 0 },
        fallidos: { type: Number, default: 0 },
      },
      email: {
        encolados: { type: Number, default: 0 },
        enviados: { type: Number, default: 0 },
        fallidos: { type: Number, default: 0 },
      },
    },

    estado: {
      type: String,
      enum: ['CREADA', 'ENVIANDO', 'COMPLETADA', 'FALLIDA'],
      default: 'CREADA',
    },
    lastError: {
      type: String,
    },
    // JWT recibido desde vector-rag-app. Solo se usa internamente para llamar a vector-rag.
    jwtToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

CampaignSchema.index({ tenantId: 1, createdAt: -1 });

export const CampaignModel = model('Campaign', CampaignSchema);

