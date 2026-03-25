(function () {
  'use strict';

  const GLSL_TO_HLSL = {
    // Types
    'vec2': 'float2', 'vec3': 'float3', 'vec4': 'float4',
    'ivec2': 'int2', 'ivec3': 'int3', 'ivec4': 'int4',
    'bvec2': 'bool2', 'bvec3': 'bool3', 'bvec4': 'bool4',
    'mat2': 'float2x2', 'mat3': 'float3x3', 'mat4': 'float4x4',
    'sampler2D': 'Texture2D',
    // Functions
    'mix': 'lerp', 'fract': 'frac', 'mod': 'fmod',
    'texture': 'tex2D', 'texture2D': 'tex2D',
    'inversesqrt': 'rsqrt',
    'dFdx': 'ddx', 'dFdy': 'ddy',
    // Built-ins
    'gl_FragCoord': 'SV_Position',
    'gl_FragColor': '/* SV_Target return */',
  };

  const GLSL_TO_SLANG = {
    // Same type/function mappings as HLSL (Slang is HLSL-compatible)
    'vec2': 'float2', 'vec3': 'float3', 'vec4': 'float4',
    'ivec2': 'int2', 'ivec3': 'int3', 'ivec4': 'int4',
    'bvec2': 'bool2', 'bvec3': 'bool3', 'bvec4': 'bool4',
    'mat2': 'float2x2', 'mat3': 'float3x3', 'mat4': 'float4x4',
    'sampler2D': 'Texture2D',
    'mix': 'lerp', 'fract': 'frac', 'mod': 'fmod',
    'texture': 'tex2D', 'texture2D': 'tex2D',
    'inversesqrt': 'rsqrt',
    'dFdx': 'ddx', 'dFdy': 'ddy',
    'gl_FragCoord': 'SV_Position',
    'gl_FragColor': '/* SV_Target return */',
  };

  // Build regex matching whole words only, longest-first
  function buildRegex(map) {
    const keys = Object.keys(map).sort((a, b) => b.length - a.length);
    const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return new RegExp('\\b(' + escaped.join('|') + ')\\b', 'g');
  }

  const HLSL_RE = buildRegex(GLSL_TO_HLSL);
  const SLANG_RE = buildRegex(GLSL_TO_SLANG);

  function translate(glslSource, targetLang) {
    const map = targetLang === 'hlsl' ? GLSL_TO_HLSL : GLSL_TO_SLANG;
    const re = targetLang === 'hlsl' ? HLSL_RE : SLANG_RE;
    re.lastIndex = 0;
    return glslSource.replace(re, match => map[match] || match);
  }

  window.ShaderTranslator = { translate };
})();
