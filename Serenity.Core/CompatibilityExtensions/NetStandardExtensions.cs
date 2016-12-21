﻿#if PORTABLE
using Microsoft.Extensions.DependencyModel;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;

namespace System
{
    public static class NetCoreExtensions
    {
        public static TAttribute GetCustomAttribute<TAttribute>(this Type type, bool inherit = true)
            where TAttribute: System.Attribute
        {
            return type.GetTypeInfo().GetCustomAttribute<TAttribute>(inherit);
        }

        public static TAttribute[] GetCustomAttributes<TAttribute>(this Type type, bool inherit = true)
             where TAttribute : System.Attribute
        {
            return type.GetTypeInfo().GetCustomAttributes<TAttribute>(inherit).ToArray();
        }

        public static Attribute[] GetCustomAttributes(this Type type, Type attributeType, bool inherit = true)
        {
            return type.GetTypeInfo().GetCustomAttributes(attributeType, inherit).ToArray();
        }

        public static bool GetIsAbstract(this Type type)
        {
            return type.GetTypeInfo().IsAbstract;
        }

        public static bool GetIsEnum(this Type type)
        {
            return type.GetTypeInfo().IsEnum;
        }

        public static bool GetContainsGenericParameters(this Type type)
        {
            return type.GetTypeInfo().ContainsGenericParameters;
        }

        public static bool GetIsGenericType(this Type type)
        {
            return type.GetTypeInfo().IsGenericType;
        }

        public static bool GetIsClass(this Type type)
        {
            return type.GetTypeInfo().IsClass;
        }

        public static bool GetIsInterface(this Type type)
        {
            return type.GetTypeInfo().IsInterface;
        }

        public static bool GetIsGenericTypeDefinition(this Type type)
        {
            return type.GetTypeInfo().IsGenericTypeDefinition;
        }

        public static Type[] GetGenericArguments(this Type type)
        {
            return type.GetTypeInfo().GetGenericArguments();
        }

        public static bool IsSubclassOf(this Type type, Type other)
        {
            return type.GetTypeInfo().IsSubclassOf(other);
        }

        public static bool GetIsPrimitive(this Type type)
        {
            return type.GetTypeInfo().IsPrimitive;
        }
    }

    public class AppDomain
    {
        public static AppDomain CurrentDomain { get; private set; }

        static AppDomain()
        {
            CurrentDomain = new AppDomain();
        }

        public Assembly[] GetAssemblies()
        {
            var assemblies = new List<Assembly>();
            var dependencies = DependencyContext.Default.RuntimeLibraries;
            foreach (var library in dependencies)
            {
                if (IsCandidateCompilationLibrary(library))
                {
                    var assembly = Assembly.Load(new AssemblyName(library.Name));
                    assemblies.Add(assembly);
                }
            }
            return assemblies.ToArray();
        }

        private static bool IsCandidateCompilationLibrary(RuntimeLibrary compilationLibrary)
        {
            return compilationLibrary.Name.StartsWith("Serenity.")
                || compilationLibrary.Dependencies.Any(d => d.Name.StartsWith("Serenity."));
        }
    }

    public class SerializableAttribute : Attribute
    {
    }
}
#endif