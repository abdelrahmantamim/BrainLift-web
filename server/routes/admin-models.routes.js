import express from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.middleware.js';
import { getSupabase } from '../config/services.config.js';
import { getModelConfig, loadModelConfig } from '../utils/modelConfig.js';

const router = express.Router();

// Get all available models and their current assignments
router.get('/', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get all available models from ai_models table
    const { data: models, error: modelsError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('is_active', true)
      .order('provider', { ascending: true })
      .order('display_name', { ascending: true });
    
    if (modelsError) throw modelsError;
    
    // Get current assignments from model_assignments table
    const { data: assignments, error: assignmentsError } = await supabase
      .from('model_assignments')
      .select('*, ai_models(*)')
      .order('feature', { ascending: true });
    
    if (assignmentsError) throw assignmentsError;
    
    // Group models by provider
    const availableModels = models.reduce((acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push({
        id: model.model_name,
        name: model.display_name,
        provider: model.provider,
        description: model.description,
        capabilities: model.capabilities
      });
      return acc;
    }, {});
    
    // Format current assignments
    const currentAssignments = {};
    assignments.forEach(assignment => {
      currentAssignments[assignment.feature] = {
        provider: assignment.ai_models?.provider,
        model_name: assignment.ai_models?.model_name,
        model_display_name: assignment.ai_models?.display_name,
        assigned_at: assignment.created_at
      };
    });
    
    // Transform models to array format for frontend
    const modelsArray = models.map(model => ({
      id: model.id,
      model_id: model.model_name,
      model_name: model.model_name,
      display_name: model.display_name,
      provider: model.provider,
      description: model.description,
      is_active: model.is_active,
      capabilities: model.capabilities || {},
      cost_per_1k_tokens: model.cost_per_1k_tokens || 0.01,
      max_tokens: model.max_tokens
    }));
    
    // Transform assignments to array format with model_id mapping
    const assignmentsArray = assignments.map(assignment => ({
      id: assignment.id,
      feature: assignment.feature,
      model_id: assignment.model_id,
      provider: assignment.ai_models?.provider,
      model_name: assignment.ai_models?.model_name,
      model_display_name: assignment.ai_models?.display_name,
      is_active: assignment.is_active,
      assigned_at: assignment.created_at
    }));
    
    res.json({
      models: modelsArray,
      assignments: assignmentsArray,
      availableModels, // Keep for backward compatibility
      currentAssignments, // Keep for backward compatibility
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Models] Error fetching models:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch model configuration' }
    });
  }
});

// Add a new model
router.post('/', requireAdminAuth, async (req, res) => {
  try {
    const { provider, model_name, display_name, api_endpoint, capabilities, cost_per_1k_tokens, is_active } = req.body;

    if (!provider || !model_name || !display_name) {
      return res.status(400).json({
        error: { message: 'Provider, model_name, and display_name are required' }
      });
    }

    const supabase = getSupabase();

    // Check if model already exists
    const { data: existing } = await supabase
      .from('ai_models')
      .select('id')
      .eq('model_name', model_name)
      .single();

    if (existing) {
      return res.status(409).json({
        error: { message: 'A model with this model name already exists' }
      });
    }

    const { data, error } = await supabase
      .from('ai_models')
      .insert({
        provider,
        model_name: model_name,
        display_name,
        api_endpoint: api_endpoint || null,
        capabilities: capabilities || {},
        cost_per_1k_tokens: cost_per_1k_tokens || 0,
        is_active: is_active !== false
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      model: data,
      message: `Model ${display_name} added successfully`
    });
  } catch (error) {
    console.error('[Admin Models] Error adding model:', error);
    res.status(500).json({
      error: { message: 'Failed to add model' }
    });
  }
});

// Delete a model
router.delete('/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    // Don't allow deleting a model that's currently assigned
    const { data: assignments } = await supabase
      .from('model_assignments')
      .select('feature')
      .eq('model_id', id);

    if (assignments && assignments.length > 0) {
      const features = assignments.map(a => a.feature).join(', ');
      return res.status(409).json({
        error: { message: `Cannot delete: model is assigned to [${features}]. Reassign first.` }
      });
    }

    const { error } = await supabase
      .from('ai_models')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true, message: 'Model deleted successfully' });
  } catch (error) {
    console.error('[Admin Models] Error deleting model:', error);
    res.status(500).json({
      error: { message: 'Failed to delete model' }
    });
  }
});

// Get model assignments
router.get('/assignments', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // Get assignments with model details
    const { data: assignments, error } = await supabase
      .from('model_assignments')
      .select('*, ai_models(*)')
      .order('feature', { ascending: true });
    
    if (error) throw error;
    
    // Transform to match expected format
    const formattedAssignments = assignments.map(assignment => ({
      id: assignment.id,
      feature: assignment.feature,
      model_id: assignment.model_id,
      service: assignment.feature, // Keep for backward compatibility
      provider: assignment.ai_models?.provider,
      modelName: assignment.ai_models?.model_name,
      modelDisplayName: assignment.ai_models?.display_name,
      enabled: assignment.is_active,
      is_active: assignment.is_active,
      lastUpdated: assignment.updated_at || assignment.created_at
    }));
    
    res.json({
      assignments: formattedAssignments,
      count: formattedAssignments.length
    });
  } catch (error) {
    console.error('[Admin Models] Error fetching assignments:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch model assignments' }
    });
  }
});

// Update model assignment
router.put('/assignments/:service', requireAdminAuth, async (req, res) => {
  try {
    const { service } = req.params;
    const { modelId } = req.body;
    
    if (!modelId) {
      return res.status(400).json({
        error: { message: 'Model ID is required' }
      });
    }
    
    const supabase = getSupabase();
    
    // First, verify the model exists
    const { data: model, error: modelError } = await supabase
      .from('ai_models')
      .select('*')
      .eq('id', modelId)
      .single();
    
    if (modelError || !model) {
      return res.status(404).json({
        error: { message: 'Model not found' }
      });
    }
    
    // Check if assignment exists
    const { data: existing, error: checkError } = await supabase
      .from('model_assignments')
      .select('*')
      .eq('feature', service)
      .single();
    
    let result;
    if (existing && !checkError) {
      // Update existing assignment
      const { data, error } = await supabase
        .from('model_assignments')
        .update({
          model_id: modelId,
          updated_at: new Date().toISOString()
        })
        .eq('feature', service)
        .select('*, ai_models(*)')
        .single();
      
      if (error) throw error;
      result = data;
    } else {
      // Create new assignment
      const { data, error } = await supabase
        .from('model_assignments')
        .insert({
          feature: service,
          model_id: modelId,
          is_active: true,
          created_at: new Date().toISOString()
        })
        .select('*, ai_models(*)')
        .single();
      
      if (error) throw error;
      result = data;
    }
    
    // Reload the model config from database
    await loadModelConfig();
    
    res.json({
      success: true,
      assignment: {
        id: result.id,
        service: result.feature,
        provider: result.ai_models?.provider,
        modelName: result.ai_models?.model_id,
        modelDisplayName: result.ai_models?.display_name,
        enabled: result.is_active,
        lastUpdated: result.updated_at || result.created_at
      },
      message: `Model assignment for ${service} updated successfully`
    });
  } catch (error) {
    console.error('[Admin Models] Error updating assignment:', error);
    res.status(500).json({
      error: { message: 'Failed to update model assignment' }
    });
  }
});

// Manually reload model configuration
router.post('/reload', requireAdminAuth, async (req, res) => {
  try {
    console.log('[Admin Models] Manual model config reload requested by admin:', req.adminEmail);
    
    // Reload the model configuration
    await loadModelConfig();
    
    // Get the current config to return
    const currentConfig = getModelConfig();
    
    res.json({
      success: true,
      message: 'Model configuration reloaded successfully',
      config: {
        chat: currentConfig.chat?.display_name || 'Not configured',
        files: currentConfig.files?.display_name || 'Not configured',
        testing: currentConfig.testing?.display_name || 'Not configured',
        lastRefresh: currentConfig.lastRefresh
      }
    });
  } catch (error) {
    console.error('[Admin Models] Error reloading model config:', error);
    res.status(500).json({
      error: { message: 'Failed to reload model configuration' }
    });
  }
});

// Test model
router.post('/test', requireAdminAuth, async (req, res) => {
  try {
    const { provider, modelName, testPrompt = 'Hello, this is a test. Please respond with "Test successful".' } = req.body;
    
    if (!provider || !modelName) {
      return res.status(400).json({
        error: { message: 'Provider and model name are required' }
      });
    }
    
    // Import the AI providers
    const { getOpenAI, getGenAI } = await import('../config/services.config.js');
    
    let response;
    const startTime = Date.now();
    
    if (provider === 'openai') {
      const openai = getOpenAI();

      // GPT-5 models use the Responses API
      if (modelName.includes('gpt-5')) {
        const result = await openai.responses.create({
          model: modelName,
          instructions: 'You are a helpful assistant.',
          input: testPrompt,
          max_output_tokens: 100,
          reasoning: { effort: 'low' },
        });
        response = result.output_text;
      } else {
        const completionOptions = {
          model: modelName,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: testPrompt }
          ],
        };
        // o-series models use max_completion_tokens
        if (modelName.includes('o1') || modelName.includes('o3') || modelName.includes('o4')) {
          completionOptions.max_completion_tokens = 100;
        } else {
          completionOptions.max_tokens = 100;
          completionOptions.temperature = 0.7;
        }
        const completion = await openai.chat.completions.create(completionOptions);
        response = completion.choices[0].message.content;
      }
    } else if (provider === 'google') {
      const genAI = getGenAI();
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(testPrompt);
      response = result.response.text();
    } else {
      return res.status(400).json({
        error: { message: 'Invalid provider' }
      });
    }
    
    const responseTime = Date.now() - startTime;
    
    res.json({
      success: true,
      provider,
      modelName,
      response,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin Models] Error testing model:', error);
    res.status(500).json({
      error: { 
        message: 'Model test failed',
        details: error.message
      }
    });
  }
});

// Get model usage statistics
router.get('/usage', requireAdminAuth, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { timeRange = '7d' } = req.query;
    
    // Calculate date range
    let startDate = new Date();
    switch (timeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // Get AI request counts from profiles
    const { data: usageData, error } = await supabase
      .from('profiles')
      .select('daily_ai_requests, monthly_ai_requests, total_ai_requests')
      .gte('last_request_date', startDate.toISOString());
    
    if (error) throw error;
    
    // Aggregate the data
    const usage = {
      daily: usageData.reduce((sum, profile) => sum + (profile.daily_ai_requests || 0), 0),
      monthly: usageData.reduce((sum, profile) => sum + (profile.monthly_ai_requests || 0), 0),
      total: usageData.reduce((sum, profile) => sum + (profile.total_ai_requests || 0), 0),
      activeUsers: usageData.length,
      timeRange,
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString()
    };
    
    res.json(usage);
  } catch (error) {
    console.error('[Admin Models] Error fetching usage:', error);
    res.status(500).json({
      error: { message: 'Failed to fetch usage statistics' }
    });
  }
});

export default router;