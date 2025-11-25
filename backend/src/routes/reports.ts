/**
 * Report Routes
 * Task #58 - 实现 B2B 定制化报表导出
 *
 * API endpoints for generating and downloading CSV reports
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  generateReport,
  getReportFilename,
  type ReportType,
} from '../services/reportService.js';

// =============================================================================
// Types
// =============================================================================

interface ExportQueryParams {
  address: string;
  type?: ReportType;
  startDate?: string;
  endDate?: string;
  format?: 'csv';
}

// =============================================================================
// Constants
// =============================================================================

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const VALID_REPORT_TYPES: ReportType[] = ['transactions', 'netvalue', 'summary'];
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// =============================================================================
// Validation
// =============================================================================

function isValidEthAddress(address: string): boolean {
  return ETH_ADDRESS_REGEX.test(address);
}

function isValidReportType(type: string): type is ReportType {
  return VALID_REPORT_TYPES.includes(type as ReportType);
}

function isValidDate(dateStr: string): boolean {
  if (!DATE_REGEX.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00.000Z');
}

function parseEndDate(dateStr: string): Date {
  // End date should include the entire day
  return new Date(dateStr + 'T23:59:59.999Z');
}

// =============================================================================
// Route Plugin
// =============================================================================

export const reportRoutes: FastifyPluginAsync = async (
  server: FastifyInstance
): Promise<void> => {
  // GET /reports/export - Export data as CSV
  server.get<{
    Querystring: ExportQueryParams;
  }>(
    '/reports/export',
    {
      schema: {
        tags: ['reports'],
        summary: 'Export report as CSV',
        description: 'Generate and download a CSV report for transaction history, net value, or summary data',
        querystring: {
          type: 'object',
          required: ['address'],
          properties: {
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Ethereum wallet address',
            },
            type: {
              type: 'string',
              enum: ['transactions', 'netvalue', 'summary'],
              default: 'transactions',
              description: 'Report type: transactions (default), netvalue, or summary',
            },
            startDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              pattern: '^\\d{4}-\\d{2}-\\d{2}$',
              description: 'End date in YYYY-MM-DD format',
            },
            format: {
              type: 'string',
              enum: ['csv'],
              default: 'csv',
              description: 'Output format (currently only CSV supported)',
            },
          },
        },
        response: {
          200: {
            type: 'string',
            description: 'CSV file content',
          },
          400: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const {
        address,
        type = 'transactions',
        startDate,
        endDate,
        format = 'csv',
      } = request.query;

      // Validate address
      if (!isValidEthAddress(address)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid Ethereum address format',
        });
      }

      // Validate report type
      if (!isValidReportType(type)) {
        return reply.status(400).send({
          success: false,
          error: `Invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(', ')}`,
        });
      }

      // Validate and parse dates
      let parsedStartDate: Date | undefined;
      let parsedEndDate: Date | undefined;

      if (startDate) {
        if (!isValidDate(startDate)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid startDate format. Use YYYY-MM-DD',
          });
        }
        parsedStartDate = parseDate(startDate);
      }

      if (endDate) {
        if (!isValidDate(endDate)) {
          return reply.status(400).send({
            success: false,
            error: 'Invalid endDate format. Use YYYY-MM-DD',
          });
        }
        parsedEndDate = parseEndDate(endDate);
      }

      // Validate date range
      if (parsedStartDate && parsedEndDate && parsedStartDate > parsedEndDate) {
        return reply.status(400).send({
          success: false,
          error: 'startDate must be before endDate',
        });
      }

      try {
        // Generate report
        const csvContent = await generateReport({
          userAddress: address,
          reportType: type,
          startDate: parsedStartDate,
          endDate: parsedEndDate,
        });

        // Generate filename
        const filename = getReportFilename(
          type,
          address,
          parsedStartDate,
          parsedEndDate
        );

        // Set headers for CSV download
        reply.header('Content-Type', 'text/csv; charset=utf-8');
        reply.header('Content-Disposition', `attachment; filename="${filename}"`);
        reply.header('Cache-Control', 'no-cache');

        return csvContent;
      } catch (error) {
        server.log.error(error, 'Failed to generate report');
        return reply.status(500).send({
          success: false,
          error: 'Failed to generate report',
        });
      }
    }
  );

  // GET /reports/types - List available report types
  server.get(
    '/reports/types',
    {
      schema: {
        tags: ['reports'],
        summary: 'List available report types',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    description: { type: 'string' },
                    requiresAddress: { type: 'boolean' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        success: true,
        data: [
          {
            type: 'transactions',
            description: 'Transaction history (deposits and withdrawals)',
            requiresAddress: true,
          },
          {
            type: 'netvalue',
            description: 'Historical net asset value data',
            requiresAddress: false,
          },
          {
            type: 'summary',
            description: 'Portfolio summary with yield calculations',
            requiresAddress: true,
          },
        ],
      };
    }
  );
};

export default reportRoutes;
